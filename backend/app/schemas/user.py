from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    job_title: str | None = Field(default=None, max_length=120)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    is_active: bool
    role: str
    job_title: str | None = None
    profile_photo_name: str | None = None
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    job_title: str | None = Field(default=None, max_length=120)


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    job_title: str | None = Field(default=None, max_length=120)
    is_active: bool | None = None
