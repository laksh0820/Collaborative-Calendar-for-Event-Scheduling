from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from datetime import timedelta
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///user.db'
app.config['SQLALCHEMY_BINDS'] = {'problems':'sqlite:///problem_set.db','submissions':'sqlite:///submissions.db'}   
app.config['SECRET_KEY'] = 'projectzetaxksdkar37ro8hf83fh3892hmfijw38fh'
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(seconds=20)

db = SQLAlchemy(app)

from Project import routes
