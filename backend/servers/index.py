"""
API серверов: список, добавление, голосование, детали.
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


def row_to_server(row) -> dict:
    return {
        "id": row[0], "name": row[1], "ip": row[2], "description": row[3],
        "version": row[4], "category": row[5], "vk_url": row[6], "discord_url": row[7],
        "telegram_url": row[8], "website_url": row[9], "image_url": row[10],
        "tags": row[11] or [], "max_online": row[12], "online": row[13],
        "premium": row[14], "top_position": row[15], "votes": row[16],
        "owner_username": row[17], "created_at": str(row[18])
    }


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
        # GET / — список серверов
        if method == 'GET' and (path.endswith('/servers') or path == '/'):
            category = params.get('category', '')
            version = params.get('version', '')
            search = params.get('search', '')
            sort = params.get('sort', 'votes')

            conditions = ["s.approved = TRUE"]
            args = []
            if category:
                conditions.append("s.category = %s")
                args.append(category)
            if version:
                conditions.append("s.version = %s")
                args.append(version)
            if search:
                conditions.append("(s.name ILIKE %s OR s.ip ILIKE %s)")
                args.extend([f'%{search}%', f'%{search}%'])

            where = "WHERE " + " AND ".join(conditions)
            order = "s.premium DESC, s.top_position ASC NULLS LAST, votes DESC" if sort == 'votes' else "s.online DESC"

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT s.id, s.name, s.ip, s.description, s.version, s.category,
                           s.vk_url, s.discord_url, s.telegram_url, s.website_url, s.image_url,
                           s.tags, s.max_online, s.online, s.premium, s.top_position,
                           COUNT(v.id) as votes, u.username, s.created_at
                    FROM servers s
                    LEFT JOIN votes v ON v.server_id = s.id
                    LEFT JOIN users u ON u.id = s.owner_id
                    {where}
                    GROUP BY s.id, u.username
                    ORDER BY {order}
                    LIMIT 100
                """, args)
                rows = cur.fetchall()

            servers = [row_to_server(r) for r in rows]
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'servers': servers})}

        # POST /add — добавить сервер
        if method == 'POST' and path.endswith('/add'):
            user = get_user_by_session(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}

            body = json.loads(event.get('body') or '{}')
            name = (body.get('name') or '').strip()
            ip = (body.get('ip') or '').strip()
            if not name or not ip:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Название и IP обязательны'})}

            tags = body.get('tags') or []
            if isinstance(tags, str):
                tags = [t.strip() for t in tags.split(',') if t.strip()]

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO servers (owner_id, name, ip, description, version, category,
                        vk_url, discord_url, telegram_url, website_url, image_url, tags)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
                """, (
                    user['id'], name, ip,
                    body.get('description'), body.get('version', '1.20'), body.get('category', 'Выживание'),
                    body.get('vk_url'), body.get('discord_url'), body.get('telegram_url'),
                    body.get('website_url'), body.get('image_url'), tags
                ))
                server_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'id': server_id, 'ok': True})}

        # POST /vote — голосовать
        if method == 'POST' and path.endswith('/vote'):
            user = get_user_by_session(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}

            body = json.loads(event.get('body') or '{}')
            server_id = body.get('server_id')
            if not server_id:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'server_id обязателен'})}

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM votes WHERE user_id=%s AND server_id=%s AND DATE(voted_at)=CURRENT_DATE",
                    (user['id'], server_id)
                )
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Уже голосовал сегодня'})}
                cur.execute("INSERT INTO votes (user_id, server_id) VALUES (%s, %s)", (user['id'], server_id))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

        # GET /my — мои серверы
        if method == 'GET' and path.endswith('/my'):
            user = get_user_by_session(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Необходима авторизация'})}

            with conn.cursor() as cur:
                cur.execute("""
                    SELECT s.id, s.name, s.ip, s.description, s.version, s.category,
                           s.vk_url, s.discord_url, s.telegram_url, s.website_url, s.image_url,
                           s.tags, s.max_online, s.online, s.premium, s.top_position,
                           COUNT(v.id) as votes, u.username, s.created_at
                    FROM servers s
                    LEFT JOIN votes v ON v.server_id = s.id
                    LEFT JOIN users u ON u.id = s.owner_id
                    WHERE s.owner_id = %s
                    GROUP BY s.id, u.username
                    ORDER BY s.created_at DESC
                """, (user['id'],))
                rows = cur.fetchall()

            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'servers': [row_to_server(r) for r in rows]})}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        conn.close()
