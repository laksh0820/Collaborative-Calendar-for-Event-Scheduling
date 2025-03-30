from Project import app,db
from Project.models import *

with app.app_context():
    db.create_all()