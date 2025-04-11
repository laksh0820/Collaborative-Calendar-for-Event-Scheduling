from Project import db,app
from flask_admin import Admin,AdminIndexView
from flask import redirect,url_for,flash
from flask_login import UserMixin,LoginManager,current_user
from flask_admin.contrib.sqla import ModelView
from sqlalchemy import inspect
from datetime import datetime, timezone

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'signin'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(db.Model, UserMixin):
    user_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(500), nullable=False, unique=True)
    password = db.Column(db.String(1000), nullable=False)
    
    participations = db.relationship('Participate', backref='user', lazy=True)
    memberships = db.relationship('Member', backref='user', lazy=True)
    created_events = db.relationship('Event', backref='event_creator', lazy=True)
    
    def get_id(self):
        return self.user_id

class Event(db.Model):
    event_id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    event_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(1000))
    version_number = db.Column(db.Integer, nullable=False, default=1)
    cache_number = db.Column(db.Integer, nullable=False)
    creator = db.Column(db.Integer, db.ForeignKey('user.user_id'))
    group_id = db.Column(db.Integer, db.ForeignKey('group.group_id'))
    
    participations = db.relationship('Participate', backref='event', lazy=True)

    __mapper_args__ = {
        'version_id_col': version_number
    }

class Group(db.Model):
    group_id = db.Column(db.Integer, primary_key=True)
    group_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(1000))
    version_number = db.Column(db.Integer, nullable=False, default=1)
    
    members = db.relationship('Member', backref='group', lazy=True)
    events = db.relationship('Event', backref='host_group', lazy=True)

    __mapper_args__ = {
        'version_id_col': version_number
    }

class Participate(db.Model):
    participate_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'))
    event_id = db.Column(db.Integer, db.ForeignKey('event.event_id'))
    invite_time = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    read_status = db.Column(db.String(50), default='Unread', nullable=False)
    status = db.Column(db.String(50), default='Pending', nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'event_id', name='uq_user_event'),
        db.CheckConstraint("status IN ('Accepted', 'Declined', 'Pending')"),
        db.CheckConstraint("read_status IN ('Read', 'Unread')"),
    )

class Member(db.Model):
    member_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.user_id'))
    group_id = db.Column(db.Integer, db.ForeignKey('group.group_id'))
    invite_time = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    read_status = db.Column(db.String(50), default='Unread', nullable=False)
    permission = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default='Pending', nullable=False)
    
    __table_args__ = (
        db.CheckConstraint("permission IN ('Admin', 'Editor', 'Viewer')"),
        db.CheckConstraint("read_status IN ('Read', 'Unread')"),
        db.CheckConstraint("status IN ('Accepted', 'Declined', 'Pending')"),
    )