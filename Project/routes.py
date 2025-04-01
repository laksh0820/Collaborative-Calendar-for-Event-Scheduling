from flask import flash,redirect,url_for
from werkzeug.security import generate_password_hash,check_password_hash
from flask_login import login_user,login_required,current_user,logout_user
from Project.forms import SignInForm,SignUpForm,GroupForm
from Project.models import User,Event,Group,Participate,Member
from flask import request, render_template, jsonify
from Project import app,db
from datetime import datetime
import json
import os

@app.route('/')
def base():        
    return render_template("base.html")

# To signin an existing user
@app.route('/signin', methods=['GET','POST'])
def signin():
    form = SignInForm()
    
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            if check_password_hash(user.password,str(form.password.data)):
                login_user(user,remember=form.remember_me.data)
                flash("Logged in Successfully",'success')
                return render_template('calendar.html')
            else:
                flash("Wrong Password! Try Again",'danger')
        else:
            flash("User Not Found! Try Again",'danger')
    return render_template('signin.html',form=form,current_user=current_user)

# To create a new user
@app.route('/signup', methods=['GET','POST'])
def signup():
    form = SignUpForm()
    if form.validate_on_submit():
        user_email = User.query.filter_by(email=form.email.data).first()

        if (user_email is None):
            newUser = User()
            newUser.name = form.name.data
            newUser.email = form.email.data
            newUser.password = generate_password_hash(str(form.password.data))
            try:
                db.session.add(newUser)
                db.session.commit()
                login_user(newUser, remember=False)
                flash("User Added Successfully",'success')
            except:
                return "Unable to enter User to the Database"
            form.name.data = ''
            form.email.data = ''
            form.password.data = ''
            form.confirm_password.data = ''
            return render_template('base.html')
        else:
            flash('This email already exits. Please sign in','danger')
            return render_template('signup.html',form=form)
    return render_template('signup.html',form = form)

# Signout of a user account
@app.route('/signout',methods=['GET','POST'])
@login_required
def signout():
    logout_user()
    flash("Logged out Successfully",'success')
    return redirect(url_for('signin'))

@app.route('/create_group')
@login_required
def redirect_create_group():
    flash("Successfully Created Group",'success')
    return jsonify(success=True)

@app.route('/calendar')
@login_required
def get_calendar():
    groups = (
        db.session.query()
        .select_from(Group)
        .join(Member, Group.group_id == Member.group_id)
        .join(User, User.user_id == Member.user_id)
        .filter(User.user_id == current_user.user_id)
        .add_columns(Group.group_id,Group.group_name)
        .all()
    )
        
    return render_template('calendar.html',groups=groups)

@app.route('/data/<group_id>')
@login_required
def return_data(group_id):
    if group_id == 1:
        # Get all the events from the database created by current user
        events = current_user.created_events
    else:
        # Get all the events for the group
        events = Group.query.filter_by(group_id=group_id).first().events
    
    eventsData = [{
                'title': event.event_name,
                'description': event.description,
                'start': event.start_time.isoformat(), 
                'end': event.end_time.isoformat(),
            } for event in events]
    return jsonify(eventsData)

@app.route('/add_event',methods=['POST'])
@login_required
def add_event():
    event = request.get_json()
     
    newEvent = Event()
    newEvent.event_name = event['title']
    newEvent.description = event['description']
    newEvent.start_time = datetime.fromisoformat(event['start'])
    newEvent.end_time = datetime.fromisoformat(event['end'])
    newEvent.version_number = 0
    newEvent.creator = current_user.user_id
    newEvent.group_id = event['group_id']
    
    # To see whether a Group 1 exits (to validate foreign key)
    group = Group.query.filter_by(group_id=1).first()
    
    if group is None:
        newGroup = Group()
        newGroup.group_name = 'No Group'
        newGroup.description = 'No Description'
        newGroup.version_number = 0
        
        try:
            db.session.add(newGroup)
            db.session.commit()
        except:
            return "Unable to add event to the database"
   
    try:
        db.session.add(newEvent)
        db.session.commit()
    except:
        return "Unable to add event to the database"
    
    return jsonify(success=True)