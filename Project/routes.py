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
                return render_template('base.html')
            else:
                flash("Wrong Password! Try Again",'danger')
        else:
            flash("User not Found! Try Again",'danger')
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

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route('/create_group')
@login_required
def create_group():
    form = GroupForm()
    
    # Query all users to populate the drop-down
    all_users = User.query.order_by(User.name).all()
    
    # Set the choices for select field
    form.participants.choices = [(user.name) for user in all_users]
    
    if form.validate_on_submit():
        pass
    return render_template('dashboard.html',form=form,createGroup=True)

@app.route('/calendar')
@login_required
def get_calendar():
    return render_template('calendar.html')

@app.route('/data')
@login_required
def return_data():
    # Get all the events from the database created by current user
    events = current_user.created_events
    eventsData = [{
            'title': event.event_name,
            'description': event.description,
            'start': event.start_time.isoformat(), 
            'end': event.end_time.isoformat(),
            'className':event.color,
            'icon':event.icon
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
    newEvent.color = event['color']
    newEvent.icon = event['icon']
    newEvent.version_number = 0
    newEvent.creator = current_user.user_id
    newEvent.group_id = 1
    
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