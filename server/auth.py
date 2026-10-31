import time
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

STAFF_ROLES = ("dean", "warden", "dept_head", "committee")
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def make_token(user: dict, pseudonym: str | None = None) -> str:
    claims = {
        "sub": str(user["id"]),
        "role": user["role"],
        "department_id": str(user["department_id"]) if user.get("department_id") else None,
        "pseudonym": pseudonym,
        "exp": int(time.time()) + settings.jwt_hours * 3600,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def current_user(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> dict:
    if creds is None:
        raise HTTPException(401, "Missing token")
    try:
        return jwt.decode(creds.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")


def student(user: Annotated[dict, Depends(current_user)]) -> dict:
    if user["role"] != "student" or not user.get("pseudonym"):
        raise HTTPException(403, "Students only")
    return user


def staff(user: Annotated[dict, Depends(current_user)]) -> dict:
    if user["role"] not in STAFF_ROLES:
        raise HTTPException(403, "Staff only")
    return user
