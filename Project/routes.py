from flask import flash,redirect,url_for
from werkzeug.security import generate_password_hash,check_password_hash
from flask_login import login_user,login_required,current_user,logout_user
from Project.forms import SignInForm,SignUpForm,GroupForm
from Project.models import User,Event,Group,Participate,Member
from flask import request, render_template, jsonify
from Project import app,db
from datetime import datetime, timezone, timedelta
import json
import os

# Helper function to convert datetime to human-readable format
def human_readable_delta(dt):
    now = datetime.now(timezone.utc)  # Use UTC time instead of local
    if dt.tzinfo is None:
        # Localize naive datetime to UTC
        dt = dt.replace(tzinfo=timezone.utc)
    delta = now - dt
    seconds = delta.total_seconds()
        
    if seconds < 0:
        return "in the future"
    
    intervals = (
        ('year', 31536000),    # 365 * 24 * 3600
        ('month', 2592000),    # 30 * 24 * 3600
        ('week', 604800),      # 7 * 24 * 3600
        ('day', 86400),       # 24 * 3600
        ('hour', 3600),
        ('minute', 60),
        ('second', 1)
    )

    for name, count in intervals:
        value = int(seconds // count)
        if value >= 1:
            if value == 1:
                return f"{value} {name} ago"
            else:
                return f"{value} {name}s ago"
    
    return "Just Now"

@app.route('/')
def base():        
    return render_template("base.html")

# To signin an existing user
@app.route('/signin', methods=['GET','POST'])
def signin():
    form = SignInForm()
    
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.lower()).first()
        if user:
            if check_password_hash(user.password,str(form.password.data)):
                login_user(user,remember=form.remember_me.data)
                flash("Logged in Successfully",'success')
                return redirect(url_for('get_calendar'))
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
        user_email = User.query.filter_by(email=form.email.data.lower()).first()

        if (user_email is None):
            newUser = User()
            newUser.name = form.name.data
            newUser.email = form.email.data.lower()
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
            return redirect(url_for('get_calendar'))
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

# Group creation
@app.route('/create_group',methods=['GET','POST'])
@login_required
def create_group():
    if request.method == 'POST':
        group = request.get_json()

        try:
            newGroup = Group(
                group_name = group['name'],
                description = group['description'],
                version_number = 0
            )
            db.session.add(newGroup)
            db.session.flush()

            admin = Member(
                user_id = current_user.user_id,
                group_id = newGroup.group_id,
                read_status = 'Read',
                permission = 'Admin',
                status = 'Accepted'
            )
            db.session.add(admin)
            
            for i in range(len(group['members'])):
                user = User.query.filter_by(email=group['members'][i].lower()).first()
                if user is None:
                    continue
                newMember = Member(
                    user_id = user.user_id,
                    group_id = newGroup.group_id,
                    permission = group['permissions'][i]
                )
                db.session.add(newMember)
            db.session.commit()
        except:
            return "Unable to add new group to the database"
    
        return jsonify(success=True)

# Group and Event Invites
@app.route('/check_invites',methods=['GET','POST'])
@login_required
def check_invites():
    if request.method == 'GET':
        group_invites = (
            db.session.query()
            .select_from(Member)
            .join(Group, Member.group_id == Group.group_id)
            .filter(Member.user_id == current_user.user_id)
            .filter(Member.status == 'Pending')
            .order_by(Member.invite_time.desc())
            .add_columns(Member.member_id, Group.group_name, Group.description)
            .all()
        )

        group_invites_list = [{
            'id': invite.member_id,
            'type': 'group',
            'name': invite.group_name,
            'description': invite.description
        } for invite in group_invites]

        event_invites = (
            db.session.query()
            .select_from(Participate)
            .join(Event, Participate.event_id == Event.event_id)
            .join(User, Event.creator == User.user_id)
            .join(Group, Event.group_id == Group.group_id)
            .filter(Participate.user_id == current_user.user_id)
            .filter(Participate.status == 'Pending')
            .order_by(Participate.invite_time.desc())
            .add_columns(Participate.participate_id, Event.event_name, Event.description, Event.start_time, Event.end_time, User.name, Group.group_name)
            .all()
        )

        event_invites_list = [{
            'id': invite.participate_id,
            'type': 'event',
            'name': invite.event_name,
            'description': invite.description,
            'start_time': invite.start_time,
            'end_time': invite.end_time,
            'creator': invite.name,
            'group': invite.group_name
        } for invite in event_invites]

        return jsonify(group_invites_list + event_invites_list)

    else:
        response = request.get_json()
        try:
            if response['invite_type'] == 'group':
                invite = Member.query.filter_by(member_id=response['invite_id']).first()
            else:
                invite = Participate.query.filter_by(participate_id=response['invite_id']).first()
            invite.status = response['status']
            invite.read_status = 'Read'
            db.session.commit()
        except:
            return "Unable to edit invite status"
        return jsonify(success=True)

# To get the notifications for the user
@app.route('/get_notifications', methods=['GET', 'POST'])
@login_required
# Get the unread events and groups for the current user
def get_notifications():
    if (request.method == 'GET'):
        # For groups
        events1 = (
            db.session.query()
            .select_from(Member)
            .filter(Member.read_status == 'Unread', Member.user_id == current_user.user_id, Member.permission != 'Admin')
            .join(Group, Member.group_id == Group.group_id)
            .add_columns(Group.group_id,Group.group_name,Member.invite_time)
            .order_by(Member.invite_time.desc())
            .all()
        )

        # For events
        events2 = (
            db.session.query()
            .select_from(Participate)
            .join(Event, Participate.event_id == Event.event_id)
            .filter(Participate.read_status == 'Unread', Participate.user_id == current_user.user_id, Event.creator != current_user.get_id())
            .add_columns(Participate.event_id,Event.event_name,Participate.invite_time)
            .order_by(Participate.invite_time.desc())
            .all()
        )

        # Combine the two lists of events and sort them by invite_time in descending order
        events = sorted(events1 + events2, key=lambda x: x.invite_time, reverse=True)

        # Create a list of dictionaries to store the event details
        # Take care of event and group names
        events_list = []
        for event in events:
            if hasattr(event, 'group_name'):
                events_list.append({
                    'id': event.group_id,
                    'name': event.group_name,
                    'passed_time': human_readable_delta(event.invite_time),
                    'type': 'group'
                })
            else:
                events_list.append({
                    'id': event.event_id,
                    'name': event.event_name,
                    'passed_time': human_readable_delta(event.invite_time),
                    'type': 'event'
                })

        return jsonify(events_list)

    else:
        response = request.get_json()

        # Mark the notification as read
        try:
            if response['type'] == 'group':
                notification = Member.query.filter_by(group_id=response['id'], user_id=current_user.get_id()).first()
            else:
                notification = Participate.query.filter_by(event_id=response['id'], user_id=current_user.get_id()).first()
            notification.read_status = 'Read'
            db.session.commit()
            return jsonify(success=True)
        except:
            return "Unable to edit read status"

# To get the groups for group-select
@app.route('/get_groups')
@login_required
def get_groups():
    groups = (
        db.session.query()
        .select_from(Group)
        .join(Member, Group.group_id == Member.group_id)
        .join(User, User.user_id == Member.user_id)
        .filter(User.user_id == current_user.user_id, Member.status == 'Accepted')
        .add_columns(Group.group_id,Group.group_name,Member.permission)
        .group_by(Group.group_id,Group.group_name,Member.permission)
        .all()
    )
    
    groups_list = [{
        'group_id': group.group_id,
        'name': group.group_name,
        'permission':group.permission
    } for group in groups]
    
    return jsonify(groups_list)

# To get the calendar for the group or individual
@app.route('/calendar')
@login_required
def get_calendar():
    groups = (
        db.session.query()
        .select_from(Group)
        .join(Member, Group.group_id == Member.group_id)
        .join(User, User.user_id == Member.user_id)
        .filter(User.user_id == current_user.user_id, Member.status == 'Accepted')
        .add_columns(Group.group_id,Group.group_name,Member.permission)
        .group_by(Group.group_id,Group.group_name,Member.permission)
        .all()
    )

    return render_template('calendar.html',groups=groups)

# To get the events for the group or individual
@app.route('/data/<group_id>')
@login_required
def return_data(group_id):
    group_id = int(group_id)
    if group_id == 1:
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
                return "Unable to add group 1 to the database"
        
        # Get all the events from the database created by current user
        events_data = []
        for event in current_user.created_events:
            if event.group_id == 1:
                events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': event.start_time.isoformat(), 
                'end': event.end_time.isoformat(),
                'event_permission': 'Admin'
            })
            
        group_events = (
            db.session.query(Event)
            .join(Participate, Event.event_id == Participate.event_id)
            .filter(Participate.user_id == current_user.user_id)
            .all()
        )
        for event in group_events:
            permission = (
                db.session.query(Member)
                .select_from(Member)
                .filter(Member.group_id == event.group_id, Member.user_id == current_user.user_id)
                .add_columns(Member.permission)
                .all()
            )
            
            events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': event.start_time.isoformat(), 
                'end': event.end_time.isoformat(),
                'event_permission': f'{permission[0][1]}'
            })
            
    else:
        # Get all the events for the group
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        events = group.events
    
        events_data = []
        for event in events:
            users = (
                db.session.query()
                .select_from(User)
                .join(Participate, User.user_id == Participate.user_id)
                .filter(Participate.event_id == event.event_id)
                .add_columns(User.name,User.email)
                .all()
            )
            
            # Get participants for this event
            participants = [{
                'name': participant.name,
                'email': participant.email
                # Add other participant fields as needed
            } for participant in users]
            
            events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': event.start_time.isoformat(), 
                'end': event.end_time.isoformat(),
                'participants': participants
            })
    return jsonify(events_data)

# To get the members of the group
@app.route('/members/<group_id>')
@login_required
def get_members(group_id):
    group_id = int(group_id)
    members = (
        db.session.query()
        .select_from(User)
        .join(Member, Member.user_id == User.user_id)
        .filter(Member.group_id == group_id, Member.status == 'Accepted')
        .add_columns(User.name,User.email)
        .all()
    )
    
    members_list = [{
        'name': member.name,
        'email': member.email
    } for member in members]
    return jsonify(members_list)

# To get, delete or update the group info
@app.route('/group_info/<group_id>', methods=['GET','DELETE','PUT'])
@login_required
def get_info(group_id):
    group_id = int(group_id)
    group = Group.query.filter_by(group_id=group_id).first()

    if request.method == 'GET':
        members = (
            db.session.query()
            .select_from(User)
            .join(Member, Member.user_id == User.user_id)
            .filter(Member.group_id == group_id)
            .add_columns(User.user_id, User.name, User.email, Member.permission)
            .all()
        )
        members_list = [{
            'email': member.email,
            'role': member.permission
        } for member in members]

        authorization = any(member for member in members if member.user_id == current_user.user_id and member.permission == 'Admin')

        return jsonify({
            'name': group.group_name,
            'description': group.description,
            'members': members_list,
            'authorization': authorization,
            'curr_email': current_user.email
        })
    
    elif request.method == 'DELETE':
        try:
            events = Event.query.filter_by(group_id=group_id).all()
            for event in events:
                for participation in event.participations:
                    db.session.delete(participation)
                db.session.delete(event)
                
            members = Member.query.filter_by(group_id=group_id).all()
            for member in members:
                db.session.delete(member)
            db.session.delete(group)
            db.session.commit()
        except:
            return "Unable to delete group from the database"
        return jsonify(success=True)

    else:
        group_info = request.get_json()
        try:
            group.group_name = group_info['name']
            group.description = group_info['description']
            members = Member.query.filter_by(group_id=group_id).all()
            for member in members:
                db.session.delete(member)
            for mem in group_info['members']:
                user = User.query.filter_by(email=mem.email.lower()).first()
                if user is None:
                    continue
                newMember = Member(
                    user_id = user.user_id,
                    group_id = group.group_id,
                    permission = mem.role
                )
                db.session.add(newMember)
            db.session.commit()
        except:
            return "Unable to update group info"
        return jsonify(success=True)

# To add an event
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
    
    participantsEmail = []
    for element in event['participants']:
        participantsEmail.append(element['name'])
    
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
            
        for participantEmail in participantsEmail:
            participant = Participate()
            participant.user_id = User.query.filter_by(email=participantEmail.lower()).first().user_id
            participant.event_id = newEvent.event_id
            db.session.add(participant)
            
            if participantEmail == current_user.email:
                participant.read_status = 'Read'
                participant.status = 'Accepted'
            
        try:
            db.session.commit()
        except:
            return "Unable to add the participants"
    except:
        return "Unable to add event to the database"
    
    return jsonify(success=True)

@app.route('/remove_event/<int:event_id>', methods=['DELETE'])
@login_required
def remove_event(event_id):
    event = Event.query.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    try:
        # First delete participations
        for participation in event.participations:
            db.session.delete(participation)
        
        # Then delete the event
        db.session.delete(event)
        
        db.session.commit()
        return jsonify({'message': 'Event deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/update_participate/<int:event_id>/<email>', methods=['PUT'])
@login_required
def update_participate(event_id,email):
    user = User.query.filter_by(email=email).first()
    participant = Participate()
    participant.user_id = user.user_id
    participant.event_id = event_id
    participant.status = 'Pending'
    
    try:
        db.session.add(participant)
        db.session.commit()
        return jsonify({'name': f'{user.name}','email':f'{user.email}'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    
@app.route('/remove_participate/<int:event_id>/<email>', methods=['DELETE'])
@login_required
def remove_participate(event_id,email):
    user = User.query.filter_by(email=email).first()
    participant = Participate.query.filter_by(user_id=user.user_id,event_id=event_id).first()
    
    if participant:
        try:
            db.session.delete(participant)
            db.session.commit()
            return jsonify(success=True)
        
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify(success=True)

@app.route('/update_event/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    new_event = request.get_json()
    
    event = Event.query.filter_by(event_id=event_id).first()
    event.event_name = new_event['title']
    event.description = new_event['description']
    
    try:
        db.session.commit() 
        return jsonify(success=True)
    
    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500