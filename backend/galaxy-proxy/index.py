"""
Прокси-функция для запросов к galaxy.mobstudio.ru.
Обходит CORS и поддерживает ротацию прокси.
Действия: login_by_code, check_nick, change_nick, auth_check
"""
import json
import random
import requests

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

GALAXY_HEADERS = {
    "accept": "*/*",
    "accept-language": "ru,en;q=0.9",
    "origin": "https://galaxy.mobstudio.ru",
    "referer": "https://galaxy.mobstudio.ru/web/assets/index.html?20&page_action=change_user_nick_index&p=25",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 YaBrowser/26.3.0.0 Safari/537.36",
    "x-galaxy-client-ver": "9.5",
    "x-galaxy-kbv": "352",
    "x-galaxy-lng": "ru",
    "x-galaxy-model": "chrome 144.0.0.0",
    "x-galaxy-orientation": "portrait",
    "x-galaxy-os-ver": "1",
    "x-galaxy-platform": "web",
    "x-galaxy-scr-dpi": "1",
    "x-galaxy-scr-h": "1239",
    "x-galaxy-scr-w": "700",
    "x-galaxy-user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 YaBrowser/26.3.0.0 Safari/537.36",
}


def parse_proxy(proxy_str: str):
    """Парсит строку прокси: host:port или host:port:user:pass"""
    if not proxy_str or not proxy_str.strip():
        return None
    parts = proxy_str.strip().split(":")
    if len(parts) == 2:
        host, port = parts
        return {"http": f"http://{host}:{port}", "https": f"http://{host}:{port}"}
    elif len(parts) == 4:
        host, port, user, password = parts
        return {
            "http": f"http://{user}:{password}@{host}:{port}",
            "https": f"http://{user}:{password}@{host}:{port}",
        }
    return None


def make_galaxy_url(user_id: str, password: str) -> str:
    query_rand = random.random()
    return f"https://galaxy.mobstudio.ru/services/?&userID={user_id}&password={password}&query_rand={query_rand}"


def login_by_code(recovery_code: str, proxy_str: str = None) -> dict:
    """
    Входит по коду восстановления Galaxy.
    Код восстановления — строка вида XXXXX-XXXXX-XXXXX из настроек аккаунта.
    Возвращает userID и password для последующих запросов.
    """
    proxies = parse_proxy(proxy_str)
    login_headers = {**GALAXY_HEADERS}
    login_headers["referer"] = "https://galaxy.mobstudio.ru/web/"

    url = (
        f"https://galaxy.mobstudio.ru/services/"
        f"?a=user_login_by_code&code={requests.utils.quote(recovery_code.strip())}"
        f"&random={random.random()}&ajax=1"
    )

    try:
        resp = requests.get(url, headers=login_headers, proxies=proxies, timeout=10)
        resp.raise_for_status()
        text = resp.text.strip()

        # Ответ содержит userID и password через разделитель, либо JSON
        # Пробуем парсить как JSON
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                uid = str(data.get("userID") or data.get("user_id") or data.get("id") or "")
                pwd = str(data.get("password") or data.get("pass") or "")
                if uid and pwd:
                    return {"ok": True, "userID": uid, "password": pwd, "raw": text}
        except Exception:
            pass

        # Пробуем формат "userID:password" или "userID password"
        if ":" in text:
            parts = text.split(":", 1)
            uid, pwd = parts[0].strip(), parts[1].strip()
            if uid.isdigit() and pwd:
                return {"ok": True, "userID": uid, "password": pwd, "raw": text}

        if " " in text:
            parts = text.split(None, 1)
            if len(parts) == 2 and parts[0].strip().isdigit():
                return {"ok": True, "userID": parts[0].strip(), "password": parts[1].strip(), "raw": text}

        # Неизвестный формат — вернём raw для отладки
        if text and "error" not in text.lower() and "false" not in text.lower():
            return {"ok": False, "error": f"Неизвестный формат ответа: {text[:200]}", "raw": text}
        return {"ok": False, "error": f"Код восстановления не принят: {text[:200]}", "raw": text}

    except requests.exceptions.ProxyError as e:
        return {"ok": False, "error": f"Ошибка прокси: {str(e)}"}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "Таймаут запроса"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def check_nick(nick: str, user_id: str, password: str, proxy_str: str = None) -> dict:
    """Проверяет доступность ника"""
    url = make_galaxy_url(user_id, password)
    proxies = parse_proxy(proxy_str)

    data = {"a": "check_user_nick", "nick": nick, "ajax": "1"}

    try:
        resp = requests.post(
            url,
            headers=GALAXY_HEADERS,
            data=data,
            proxies=proxies,
            timeout=10,
        )
        resp.raise_for_status()
        text = resp.text.strip()

        # Ответ: пустая строка или пробелы = занят, непустой ник = свободен
        is_free = bool(text) and text.replace(" ", "") != ""
        return {"ok": True, "free": is_free, "raw": text}
    except requests.exceptions.ProxyError as e:
        return {"ok": False, "error": f"Ошибка прокси: {str(e)}", "free": False}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "Таймаут запроса", "free": False}
    except Exception as e:
        return {"ok": False, "error": str(e), "free": False}


def change_nick(new_nick: str, user_id: str, password: str, proxy_str: str = None) -> dict:
    """Меняет ник основного персонажа"""
    url = make_galaxy_url(user_id, password)
    proxies = parse_proxy(proxy_str)

    data = {"a": "change_user_nick", "new_nick": new_nick, "ajax": "1"}

    try:
        resp = requests.post(
            url,
            headers=GALAXY_HEADERS,
            data=data,
            proxies=proxies,
            timeout=10,
        )
        resp.raise_for_status()
        text = resp.text.strip()
        success = "ok" in text.lower() or text == new_nick or "success" in text.lower()
        return {"ok": True, "success": success, "raw": text}
    except requests.exceptions.ProxyError as e:
        return {"ok": False, "error": f"Ошибка прокси: {str(e)}", "success": False}
    except requests.exceptions.Timeout:
        return {"ok": False, "error": "Таймаут запроса", "success": False}
    except Exception as e:
        return {"ok": False, "error": str(e), "success": False}


def auth_check(user_id: str, password: str) -> dict:
    """Проверяет валидность учётных данных через pay_get_balance"""
    url = (
        f"https://galaxy.mobstudio.ru/services/"
        f"?a=pay_get_balance&userID={user_id}&password={password}"
        f"&usercur={user_id}&random={random.random()}&ajax=1"
    )
    auth_headers = {**GALAXY_HEADERS}
    auth_headers["referer"] = "https://galaxy.mobstudio.ru/web/"

    try:
        resp = requests.get(url, headers=auth_headers, timeout=10)
        resp.raise_for_status()
        text = resp.text.strip()
        # Если ответ не содержит ошибку — авторизация успешна
        valid = text != "" and "error" not in text.lower() and "false" not in text.lower()
        return {"ok": True, "valid": valid, "raw": text}
    except Exception as e:
        return {"ok": False, "error": str(e), "valid": False}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    raw_body = event.get("body") or "{}"
    if isinstance(raw_body, dict):
        body = raw_body
    else:
        try:
            body = json.loads(raw_body)
            if isinstance(body, str):
                body = json.loads(body)
        except Exception:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"ok": False, "error": "Неверный JSON"}),
            }

    action = body.get("action")
    user_id = str(body.get("userID", ""))
    password = str(body.get("password", ""))
    proxy_str = body.get("proxy", "")

    if not action:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"ok": False, "error": "Не указан action"}),
        }

    if action == "login_by_code":
        recovery_code = body.get("recovery_code", "")
        if not recovery_code:
            result = {"ok": False, "error": "Не указан recovery_code"}
        else:
            result = login_by_code(recovery_code, proxy_str)

    elif action == "check_nick":
        nick = body.get("nick", "")
        result = check_nick(nick, user_id, password, proxy_str)

    elif action == "change_nick":
        new_nick = body.get("new_nick", "")
        result = change_nick(new_nick, user_id, password, proxy_str)

    elif action == "auth_check":
        result = auth_check(user_id, password)

    else:
        result = {"ok": False, "error": f"Неизвестный action: {action}"}

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps(result),
    }