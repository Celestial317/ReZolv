from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
import db

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn):
    user = db.fetchone(
        """SELECT u.id, u.email, u.password_hash, u.role, u.name, u.department_id, sp.pseudonym
           FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
           WHERE lower(u.email) = lower(%s)""",
        (body.email.strip(),),
    )
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    return {
        "token": auth.make_token(user, user["pseudonym"]),
        "role": user["role"],
        "name": user["name"],
        "pseudonym": user["pseudonym"],
        "department_id": user["department_id"],
    }


@router.get("/me")
def me(claims: Annotated[dict, Depends(auth.current_user)]):
    row = db.fetchone(
        """SELECT u.id, u.email, u.role, u.name, u.created_at, d.name AS department, sp.pseudonym
           FROM users u LEFT JOIN departments d ON d.id = u.department_id
           LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = %s""",
        (claims["sub"],),
    )
    if not row:
        raise HTTPException(401, "Account no longer exists")
    return row


class PasswordIn(BaseModel):
    current: str
    new: str


@router.post("/password")
def change_password(body: PasswordIn, claims: Annotated[dict, Depends(auth.current_user)]):
    user = db.fetchone("SELECT id, password_hash FROM users WHERE id = %s", (claims["sub"],))
    if not user or not auth.verify_password(body.current, user["password_hash"]):
        raise HTTPException(400, "Current password is wrong")
    if len(body.new) < 8:
        raise HTTPException(400, "Use at least 8 characters")
    db.execute("UPDATE users SET password_hash = %s WHERE id = %s", (auth.hash_password(body.new), user["id"]))
    return {"ok": True}
