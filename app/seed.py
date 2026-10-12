"""Siembra categorías por defecto si la base de datos está vacía. No pisa nada
que el usuario ya haya creado o editado."""
from app import models

DEFAULT_CATEGORIES = [
    ("Casa", "#F4A259"),
    ("Rutina", "#5B8E7D"),
    ("Coche", "#BC4749"),
    ("Guitarra", "#8E7DBE"),
    ("Deporte", "#4A7C59"),
    ("Trabajo", "#3A6EA5"),
]


def seed_default_categories(db):
    if db.query(models.Category).count() > 0:
        return
    for name, color in DEFAULT_CATEGORIES:
        db.add(models.Category(name=name, color=color))
    db.commit()
