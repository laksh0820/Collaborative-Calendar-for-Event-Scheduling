from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import timedelta
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///event_management.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False   
app.config['SECRET_KEY'] = 'eventmanagementksdkar37ro8hf83fh3892hmfijw38fh'
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(seconds=20)
app.config['EXPLAIN_TEMPLATE_LOADING'] = False
app.config['DEBUG'] = True
app.config['TESTING'] = False

db = SQLAlchemy(app)

from Project import routes
