from flask import Flask,flash
from werkzeug.security import generate_password_hash,check_password_hash
from flask_login import login_user,login_required,current_user,logout_user
from Project.forms import SignInForm,SignUpForm,GroupForm
from Project.models import User,Event,Group,Participate,Member
from flask import request, render_template, jsonify
from Project import app,db
import json
import os

# To signin an existing user
@app.route('/signin', methods=['GET','POST'])
def signin():
    form = SignInForm()
    
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user:
            if check_password_hash(user.password,str(form.password.data)):
                login_user(user,remember=form.remember_me.data)
                flash("Logged in Successfully")
                return render_template('base.html')
            else:
                flash("Wrong Password! Try Again",'error')
        else:
            flash("User not Found! Try Again",'error')
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
                flash("User Added Successfully")
            except:
                return "Unable to enter User to the Database"
            form.name.data = ''
            form.email.data = ''
            form.password.data = ''
            form.confirm_password.data = ''
            return render_template('base.html')
        else:
            flash('This email already exits. Please sign in','error')
            return render_template('signup.html',form=form)
    return render_template('signup.html',form = form)

# Define the path to the events.json file
EVENTS_FILE = os.path.join(os.path.dirname(__file__), 'events.json')

@app.route('/')
def base():
    return render_template("base.html")

@app.route('/calendar')
def get_calendar():
    return render_template('calendar.html')

@app.route('/data')
def return_data():
    start_date = request.args.get('start', '')
    end_date = request.args.get('end', '')

    with open(EVENTS_FILE, "r") as input_data:
        return input_data.read()
    
# Load existing events from the file (if it exists)
def load_events():
    with open(EVENTS_FILE, 'r') as file:
        return json.load(file)
    
# Save events to the file
def save_events(events):
    with open(EVENTS_FILE, 'w') as file:
        json.dump(events, file, indent=4)

@app.route('/add_event',methods=['POST'])
def add_event():
    new_event = request.get_json()
    events = load_events()
    events.append(new_event)
    save_events(events)
    return jsonify(success=True)