"""
API отзывов: получение и добавление отзывов к серверам.
"""
import json
import os
import psycopg2

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_user_by_session(conn, sid: str):
    if not sid:
        return None
    with conn.cursor() as cur:
        cur.execute(
            "SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
            (sid,)
        )
        row = cur.fetchone()
    return {"id": row[0], "username": row[1]} if row else None


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    session_id = headers.get('X-Session-Id') or headers.get('x-session-id')
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    try:
        # GET / — список отзывов (можно фильтровать по server_id)
        if method == 'GET':
            server_id = params.get('server_id')
            with conn.cursor() as cur:
                if server_id:
                    cur.execute("""
                        SELECT r.id, r.stars, r.text, r.created_at, u.username, s.name
                        FROM reviews r
                        JOIN users u ON u.id = r.user_id
                        JOIN servers s ON s.id = r.server_id
                        WHERE r.server_id = %s
                        ORDER BY r.created_at DESC
                        LIMIT 50
                    """, (server_id,))
                else:
                    cur.execute("""
                        SELECT r.id, r.stars, r.text, r.created_at, u.username, s.name
                        FROM reviews r
                        JOIN users u ON u.id = r.user_id
                        JOIN servers s ON s.id = r.server_id
                        ORDER BY r.created_at DESC
                        LIMIT 50
                    """)
                rows = cur.fetchall()

            reviews = [
                {"id": r[0], "stars": r[1], "text": r[2], "created_at": str(r[3]), "username": r[4], "server_name": r[5]}
                for r in rows
            ]
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'reviews': reviews})}

        # POST / — добавить отзыв
        if method == 'POST':
            user = get_user_by_session(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}

            body = json.loads(event.get('body') or '{}')
            server_id = body.get('server_id')
            stars = body.get('stars')
            text = (body.get('text') or '').strip()

            if not server_id or not stars or not text:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Заполните все поля'})}
            if not (1 <= int(stars) <= 5):
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Оценка от 1 до 5'})}

            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO reviews (user_id, server_id, stars, text) VALUES (%s, %s, %s, %s) RETURNING id",
                    (user['id'], server_id, int(stars), text)
                )
                review_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'id': review_id, 'ok': True})}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        conn.close()
