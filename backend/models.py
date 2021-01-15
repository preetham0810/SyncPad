from pydantic import BaseModel


class NoteCreate(BaseModel):
    title: str = "Untitled"


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str
    updated_at: str
