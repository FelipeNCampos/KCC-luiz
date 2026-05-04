from datetime import datetime

from pydantic import BaseModel, Field


class FlatInstructionWrite(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1, max_length=255)
    video_url: str | None = Field(default=None, max_length=1000)
    video_name: str | None = Field(default=None, max_length=255)
    video_data: str | None = None
    description: str = Field(min_length=1)
    position: int = 0


class FlatInstructionSave(BaseModel):
    items: list[FlatInstructionWrite] = Field(default_factory=list)


class FlatInstructionRead(BaseModel):
    id: str
    title: str
    video_url: str | None = None
    video_name: str | None = None
    video_data: str | None = None
    description: str
    position: int
    building_id: str
    condominio_id: str
    created_at: datetime
    updated_at: datetime
