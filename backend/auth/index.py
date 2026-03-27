"""
API авторизации: регистрация, вход, выход, получение текущего пользователя.
"""
import json
import os
import hashlib
import secrets
import psycopg2

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def make_session(conn, user_id: int) -> str:
    sid = secrets.token_hex(64)
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO sessions (id, user_id) VALUES (%s, %s)",
            (sid, user_id)
        )
    conn.commit()
    return sid


def get_user_by_session(conn, sid: str):
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.avatar_url, u.auth_provider
               FROM sessions s JOIN users u ON u.id = s.user_id
               WHERE s.id = %s AND s.expires_at > NOW()""",
            (sid,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "username": row[1], "email": row[2], "avatar_url": row[3], "auth_provider": row[4]}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    session_id = headers.get('X-Session-Id') or headers.get('x-session-id')

    conn = get_conn()

    try:
        # GET /me — текущий пользователь
        if method == 'GET' and path.endswith('/me'):
            if not session_id:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не авторизован'})}
            user = get_user_by_session(conn, session_id)
            if not user:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'user': user})}

        body = json.loads(event.get('body') or '{}')

        # POST /register
        if method == 'POST' and path.endswith('/register'):
            username = (body.get('username') or '').strip()
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''

            if not username or not email or not password:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Заполните все поля'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE email=%s OR username=%s", (email, username))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Email или никнейм уже занят'})}
                cur.execute(
                    "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
                    (username, email, hash_password(password))
                )
                user_id = cur.fetchone()[0]
            conn.commit()
            sid = make_session(conn, user_id)
            return {
                'statusCode': 200, 'headers': CORS_HEADERS,
                'body': json.dumps({'session_id': sid, 'user': {'id': user_id, 'username': username, 'email': email}})
            }

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''

            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, username, email, avatar_url FROM users WHERE email=%s AND password_hash=%s",
                    (email, hash_password(password))
                )
                row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Неверный email или пароль'})}
            sid = make_session(conn, row[0])
            return {
                'statusCode': 200, 'headers': CORS_HEADERS,
                'body': json.dumps({'session_id': sid, 'user': {'id': row[0], 'username': row[1], 'email': row[2], 'avatar_url': row[3]}})
            }

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if session_id:
                with conn.cursor() as cur:
                    cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                conn.commit()
            return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    finally:
        conn.close()
