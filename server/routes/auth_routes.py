from fastapi import APIRouter, HTTPException
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
