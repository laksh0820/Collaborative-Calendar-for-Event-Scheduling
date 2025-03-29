from flask import Flask,flash
from werkzeug.security import generate_password_hash,check_password_hash
from flask_login import login_user,login_required,current_user,logout_user
from Project.forms import SignInForm,SignUpForm,GroupForm
from flask import request, render_template, jsonify
from Project import app
import json
import os

@app.route('/signin')
def signin():
    form = SignInForm()
    
    # if form.validate_on_submit():
    #     user = User.query.filter_by(email=form.email.data).first()
    #     if user:
    #         if check_password_hash(user.password,str(form.password.data)):
    #             login_user(user,remember=form.remember_me.data)
    #             flash("Logged in Successfully")
    #             return render_template('base.html')
    #         else:
    #             flash("Wrong Password! Try Again",'error')
    #     else:
    #         flash("User not Found! Try Again",'error')
    return render_template('signin.html',form=form,current_user=current_user)

@app.route('/signup')
def signup():
    form = SignUpForm()
    return render_template('signup.html',form=form)

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