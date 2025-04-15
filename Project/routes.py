from flask import flash,redirect,url_for
from werkzeug.security import generate_password_hash,check_password_hash
from flask_login import login_user,login_required,current_user,logout_user
from Project.forms import SignInForm,SignUpForm,GroupForm
from Project.models import User,Event,Group,Participate,Member
from flask import request, render_template, jsonify
from sqlalchemy import func, update, exists
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.orm.attributes import flag_modified
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
    if (current_user.is_authenticated):
        return redirect(url_for('get_calendar'))

    return render_template("cover.html")

# To signin an existing user
@app.route('/signin', methods=['GET','POST'])
def signin():
    form = SignInForm()
    
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.strip().lower()).first()
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
        user_email = User.query.filter_by(email=form.email.data.strip().lower()).first()

        if (user_email is None):
            newUser = User(
                name = form.name.data.strip(),
                email = form.email.data.strip().lower(),
                password = generate_password_hash(str(form.password.data))
            )
            try:
                db.session.add(newUser)
                db.session.commit()
                login_user(newUser, remember=False)
                flash("User Added Successfully",'success')
            except:
                return "Unable to enter User to the Database", 500
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

# To change user profile settings
@app.route('/user_profile', methods = ['GET','POST'])
@login_required
def user_profile():
    if request.method == 'POST':
        form = request.get_json()
        user = User.query.filter_by(user_id=current_user.user_id).first()
        if user:
            try:
                user.name = form['name'].strip()
                user.email = form['email'].strip()
                user.password = generate_password_hash(str(form['password']))
                db.session.commit()
                return jsonify(success=True), 200
            except:
                return jsonify({'error':'Unable to update profile settings'}), 500
    return jsonify({'name':current_user.name, 'email':current_user.email}), 200

# Group creation
@app.route('/create_group',methods=['GET','POST'])
@login_required
def create_group():
    if request.method == 'POST':
        group = request.get_json()
        invalid_emails = []

        try:
            newGroup = Group(
                group_name = group['name'],
                description = group['description']
            )
            db.session.add(newGroup)
            db.session.flush()

            db.session.add(Member(
                user_id = current_user.user_id,
                group_id = newGroup.group_id,
                read_status = 'Read',
                permission = 'Admin',
                status = 'Accepted'
            ))
            
            for i in range(len(group['members'])):
                email = group['members'][i].strip().lower()
                if email == current_user.email:
                    continue
                user = User.query.filter_by(email=email).first()
                if user is None:
                    invalid_emails.append(email)
                    continue
                newMember = Member(
                    user_id = user.user_id,
                    group_id = newGroup.group_id,
                    permission = group['permissions'][i]
                )
                db.session.add(newMember)
            db.session.commit()
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to add new group to the database"}), 500
    
        return jsonify({'emails': invalid_emails}), 200

# To get the number of pending invites for the user
@app.route('/get_pending_invites_count', methods=['GET'])
@login_required
def get_pending_invites_count():
    group_invite_count = (
        db.session.query(func.count(Member.member_id))
        .join(Member.group)
        .filter(
            Member.user_id == current_user.user_id,
            Member.status == 'Pending'
        )
        .scalar()
    )

    event_invite_count = (
        db.session.query(func.count(Participate.participate_id))
        .join(Participate.event)
        .filter(
            Participate.user_id == current_user.user_id,
            Participate.status == 'Pending'
        )
        .scalar()
    )

    return jsonify(group_invite_count + event_invite_count) 

# Group and Event Invites
@app.route('/check_invites',methods=['GET','POST'])
@login_required
def check_invites():
    if request.method == 'GET':
        group_invites = (
            db.session.query(Member.member_id, Group.group_name, Group.description)
            .join(Member.group)
            .filter(
                Member.user_id == current_user.user_id,
                Member.status == 'Pending'
            )
            .order_by(Member.invite_time.desc())
            .all()
        )

        group_invites_list = [{
            'id': invite.member_id,
            'type': 'group',
            'name': invite.group_name,
            'description': invite.description
        } for invite in group_invites]

        event_invites = (
            db.session.query(
                Participate.participate_id,
                Event.event_name,
                Event.description,
                Event.start_time,
                Event.end_time,
                User.name,
                Group.group_name
            )
            .join(Participate.event)
            .join(Event.event_creator)
            .join(Event.host_group)
            .filter(
                Participate.user_id == current_user.user_id,
                Participate.status == 'Pending'
            )
            .order_by(Participate.invite_time.desc())
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
                if response['status'] == 'Declined':
                    db.session.delete(invite)
                else:
                    invite.status = response['status']
                    invite.read_status = 'Read'
                group_id = 0
            else:
                invite = Participate.query.filter_by(participate_id=response['invite_id']).first()
                group_id = invite.event.group_id
                invite.status = response['status']
                invite.read_status = 'Read'
                db.session.execute(
                    update(Event)
                    .where(Event.event_id == invite.event_id)
                    .values(cache_number = Event.cache_number + 1)
                )
            db.session.commit()
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to edit invite status"}), 500
        return jsonify({'group_id':f'{group_id}'}), 200

# To get the number of unread notifications for the user
@app.route('/get_unread_notifications_count', methods=['GET'])
@login_required
def get_unread_notifications_count():
    # For groups
    unread_groups = (
        db.session.query(func.count(Member.member_id))
        .join(Member.group)
        .filter(
            Member.user_id == current_user.user_id,
            Member.read_status == 'Unread'
        )
        .scalar()
    )

    # For events
    unread_events = (
        db.session.query(func.count(Participate.participate_id))
        .join(Participate.event)
        .filter(
            Participate.user_id == current_user.user_id,
            Participate.read_status == 'Unread'
        )
        .scalar()
    )

    return jsonify(unread_groups + unread_events)

# To get the notifications for the user
@app.route('/get_notifications', methods=['GET', 'POST'])
@login_required
# Get the unread events and groups for the current user
def get_notifications():
    if (request.method == 'GET'):
        # For groups
        events1 = (
            db.session.query(Group.group_id, Group.group_name, Member.invite_time)
            .join(Member.group)
            .filter(
                Member.read_status == 'Unread',
                Member.user_id == current_user.user_id
            )
            .order_by(Member.invite_time.desc())
            .all()
        )

        # For events
        events2 = (
            db.session.query(Participate.event_id, Event.event_name, Participate.invite_time)
            .join(Participate.event)
            .filter(
                Participate.read_status == 'Unread',
                Participate.user_id == current_user.user_id
            )
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
                notification = Member.query.filter_by(group_id=response['id'], user_id=current_user.user_id).first()
            else:
                notification = Participate.query.filter_by(event_id=response['id'], user_id=current_user.user_id).first()
            notification.read_status = 'Read'
            db.session.commit()
            return jsonify(success=True), 200
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to edit read status"}), 500

# To get the groups for group-select
@app.route('/get_groups')
@login_required
def get_groups():
    groups = (
        db.session.query(Group.group_id, Group.group_name)
        .join(Group.members)
        .filter(
            Member.user_id == current_user.user_id,
            Member.status == 'Accepted'
        )
        .group_by(Group.group_id, Group.group_name)
        .all()
    )
    
    groups_list = [{
        'group_id': group.group_id,
        'name': group.group_name
    } for group in groups]
    
    return jsonify(groups_list)

# To get the calendar for the group or individual
@app.route('/calendar', methods=['GET','POST'])
@login_required
def get_calendar():
    groups = (
        db.session.query(Group.group_id, Group.group_name, Member.permission)
        .join(Group.members)
        .filter(
            Member.user_id == current_user.user_id,
            Member.status == 'Accepted'
        )
        .group_by(Group.group_id, Group.group_name, Member.permission)
        .all()
    )

    return render_template('calendar.html',groups=groups)

# To get the events for the group or individual
@app.route('/data/<int:group_id>')
@login_required
def return_data(group_id):
    if group_id == 1:
        # To see whether a Group 1 exits (to validate foreign key)
        group = Group.query.filter_by(group_id=1).first()
        
        if group is None:
            newGroup = Group(
                group_name = 'No Group',
                description = 'No Description'
            )
            
            try:
                db.session.add(newGroup)
                db.session.commit()
            except:
                db.session.rollback()
                return jsonify({'error': "Unable to add group 1 to the database"}), 500
        
        # Get all the events from the database created by current user
        events_data = []
        for event in current_user.created_events:
            local_start_time = event.start_time.astimezone()
            local_end_time = event.end_time.astimezone()
            if event.start_time.tzinfo is None:
                local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                local_start_time = local_start_time.astimezone()
            if event.end_time.tzinfo is None:
                local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                local_end_time = local_end_time.astimezone()
            
            if event.group_id == 1:
                events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': local_start_time.isoformat(), 
                'end': local_end_time.isoformat(),
                'event_type': 'individual',
                'is_pending_for_current_user': False,
                'event_edit_permission': 'Admin',
                'version': event.version_number,
                'cache_number': event.cache_number
            })
            
        group_events = (
            db.session.query(Event)
            .join(Event.participations)
            .filter(Participate.user_id == current_user.user_id)
            .filter(Participate.status != 'Declined')
            .all()
        )
        for event in group_events:
            users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(Participate.event_id == event.event_id)
                .all()
            )
            
            accepted_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Accepted'
                )
                .all()
            )
            
            pending_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Pending'
                )
                .all()
            )
            
            declined_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Declined'
                )
                .all()
            )
            
            # Get participants for this event
            participants = [{
                'name': participant.name,
                'email': participant.email
                # Add other participant fields as needed
            } for participant in users]
            
            accepted_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in accepted_users]
            
            pending_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in pending_users]
            
            declined_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in declined_users]
            
            is_pending = any(
                participant['email'] == current_user.email 
                for participant in pending_participants
            )

            local_start_time = event.start_time.astimezone()
            local_end_time = event.end_time.astimezone()
            if event.start_time.tzinfo is None:
                local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                local_start_time = local_start_time.astimezone()
            if event.end_time.tzinfo is None:
                local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                local_end_time = local_end_time.astimezone()

            events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': local_start_time.isoformat(), 
                'end': local_end_time.isoformat(),
                'event_type': 'group',
                'participants': participants,
                'accepted_participants': accepted_participants,
                'pending_participants':pending_participants,
                'declined_participants':declined_participants,
                'is_pending_for_current_user': is_pending,
                'event_edit_permission': 'Viewer',
                'version': event.version_number,
                'cache_number': event.cache_number
            })
            
    else:
        # Get all the events for the group
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
    
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
        permission = mem.permission

        events = group.events
        events_data = []
        for event in events:
            users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(Participate.event_id == event.event_id)
                .all()
            )
            
            accepted_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Accepted'
                )
                .all()
            )
            
            pending_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Pending'
                )
                .all()
            )
            
            declined_users = (
                db.session.query(User.name, User.email)
                .join(User.participations)
                .filter(
                    Participate.event_id == event.event_id,
                    Participate.status == 'Declined'
                )
                .all()
            )
            
            # Get participants for this event
            participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in users]
            
            accepted_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in accepted_users]
            
            pending_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in pending_users]
            
            declined_participants = [{
                'name': participant.name,
                'email': participant.email
            } for participant in declined_users]
            
            is_pending = any(
                participant['email'] == current_user.email 
                for participant in pending_participants
            )

            local_start_time = event.start_time.astimezone()
            local_end_time = event.end_time.astimezone()
            if event.start_time.tzinfo is None:
                local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                local_start_time = local_start_time.astimezone()
            if event.end_time.tzinfo is None:
                local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                local_end_time = local_end_time.astimezone()

            events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': local_start_time.isoformat(), 
                'end': local_end_time.isoformat(),
                'participants': participants,
                'accepted_participants': accepted_participants,
                'pending_participants': pending_participants,
                'declined_participants': declined_participants,
                'is_pending_for_current_user': is_pending,
                'event_edit_permission': permission,
                'version': event.version_number,
                'cache_number':event.cache_number
            })
    return jsonify(events_data)

# To get the updated / new events for the group or individual
@app.route('/data/<int:group_id>/updates', methods=['POST'])
@login_required
def return_update_data(group_id):
    versionMap = request.get_json()
    
    cached_events = []
    for element in versionMap['events']:
        cached_events.append(element['event_id'])
    version_map = {item['event_id']: item['cache_number'] for item in versionMap['events']}
     
    if group_id == 1:
        # Get all the events from the database created by current user
        events_data = []
        
        # Get event_id of all the events that are deleted but still available in cache
        deleted_events = []
        
        # Events that are currently have current user as participantion or individual
        current_user_events = []
    
        for event in current_user.created_events:
            if event.group_id == 1:
                current_user_events.append(event.event_id)
        
        for event in current_user.created_events:
            local_start_time = event.start_time.astimezone()
            local_end_time = event.end_time.astimezone()
            if event.start_time.tzinfo is None:
                local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                local_start_time = local_start_time.astimezone()
            if event.end_time.tzinfo is None:
                local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                local_end_time = local_end_time.astimezone()
            
            if event.group_id == 1 and (event.event_id not in cached_events or version_map[event.event_id] < event.cache_number):
                events_data.append({
                'event_id': event.event_id,
                'title': event.event_name,
                'description': event.description,
                'start': local_start_time.isoformat(), 
                'end': local_end_time.isoformat(),
                'event_type': 'individual',
                'is_pending_for_current_user': False,
                'event_edit_permission': 'Admin',
                'version': event.version_number,
                'cache_number':event.cache_number
            })
            
        group_events = (
            db.session.query(Event)
            .join(Participate, Event.event_id == Participate.event_id)
            .filter(Participate.user_id == current_user.user_id)
            .all()
        )
        
        for event in group_events:
            current_user_events.append(event.event_id)
            
        for event in group_events:
            if (event.event_id not in cached_events or version_map[event.event_id] < event.cache_number):
                users = (
                    db.session.query()
                    .select_from(User)
                    .join(Participate, User.user_id == Participate.user_id)
                    .filter(Participate.event_id == event.event_id)
                    .add_columns(User.name,User.email)
                    .all()
                )
                
                accepted_users = (
                    db.session.query()
                    .select_from(User)
                    .join(Participate, User.user_id == Participate.user_id)
                    .filter(Participate.event_id == event.event_id, Participate.status == 'Accepted')
                    .add_columns(User.name,User.email)
                    .all()
                )
                
                pending_users = (
                    db.session.query()
                    .select_from(User)
                    .join(Participate, User.user_id == Participate.user_id)
                    .filter(Participate.event_id == event.event_id, Participate.status == 'Pending')
                    .add_columns(User.name,User.email)
                    .all()
                )
                
                declined_users = (
                    db.session.query()
                    .select_from(User)
                    .join(Participate, User.user_id == Participate.user_id)
                    .filter(Participate.event_id == event.event_id, Participate.status == 'Declined')
                    .add_columns(User.name,User.email)
                    .all()
                )
                
                # Get participants for this event
                participants = [{
                    'name': participant.name,
                    'email': participant.email
                    # Add other participant fields as needed
                } for participant in users]
                
                accepted_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in accepted_users]
                
                pending_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in pending_users]
                
                declined_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in declined_users]
                
                is_pending = any(
                    participant['email'] == current_user.email 
                    for participant in pending_participants
                )

                local_start_time = event.start_time.astimezone()
                local_end_time = event.end_time.astimezone()
                if event.start_time.tzinfo is None:
                    local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                    local_start_time = local_start_time.astimezone()
                if event.end_time.tzinfo is None:
                    local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                    local_end_time = local_end_time.astimezone()

                events_data.append({
                    'event_id': event.event_id,
                    'title': event.event_name,
                    'description': event.description,
                    'start': local_start_time.isoformat(), 
                    'end': local_end_time.isoformat(),
                    'event_type': 'group',
                    'participants': participants,
                    'accepted_participants': accepted_participants,
                    'pending_participants':pending_participants,
                    'declined_participants':declined_participants,
                    'is_pending_for_current_user': is_pending,
                    'event_edit_permission': 'Viewer',
                    'version': event.version_number,
                    'cache_number':event.cache_number
                })
      
        for cached_event_id in cached_events:
            if cached_event_id not in current_user_events:
                deleted_events.append(cached_event_id)
                      
    else:
        # Get all the events for the group
        group = Group.query.filter_by(group_id=group_id).first()
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
        permission = mem.permission
        
        events = group.events
    
        events_data = [] # To store new and updated events
        deleted_events = [] # To store events that are deleted but still present in the cache
        
        for cached_event_id in cached_events:
            present = 0
            for event in events:
                if cached_event_id == event.event_id:
                    present = 1
                    break
            if present == 0:
                deleted_events.append(cached_event_id)
                
        for event in events:
            if (event.event_id not in cached_events or version_map[event.event_id] < event.cache_number):
                users = (
                    db.session.query(User.name, User.email)
                    .join(User.participations)
                    .filter(Participate.event_id == event.event_id)
                    .all()
                )
                
                accepted_users = (
                    db.session.query(User.name, User.email)
                    .join(User.participations)
                    .filter(
                        Participate.event_id == event.event_id,
                        Participate.status == 'Accepted'
                    )
                    .all()
                )
                
                pending_users = (
                    db.session.query(User.name, User.email)
                    .join(User.participations)
                    .filter(
                        Participate.event_id == event.event_id,
                        Participate.status == 'Pending'
                    )
                    .all()
                )
                
                declined_users = (
                    db.session.query(User.name, User.email)
                    .join(User.participations)
                    .filter(
                        Participate.event_id == event.event_id,
                        Participate.status == 'Declined'
                    )
                    .all()
                )
                
                # Get participants for this event
                participants = [{
                    'name': participant.name,
                    'email': participant.email
                    # Add other participant fields as needed
                } for participant in users]
                
                accepted_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in accepted_users]
                
                pending_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in pending_users]
                
                declined_participants = [{
                    'name': participant.name,
                    'email': participant.email
                } for participant in declined_users]
                
                is_pending = any(
                    participant['email'] == current_user.email 
                    for participant in pending_participants
                )

                local_start_time = event.start_time.astimezone()
                local_end_time = event.end_time.astimezone()
                if event.start_time.tzinfo is None:
                    local_start_time = event.start_time.replace(tzinfo=timezone.utc)
                    local_start_time = local_start_time.astimezone()
                if event.end_time.tzinfo is None:
                    local_end_time = event.end_time.replace(tzinfo=timezone.utc)
                    local_end_time = local_end_time.astimezone()

                events_data.append({
                    'event_id': event.event_id,
                    'title': event.event_name,
                    'description': event.description,
                    'start': local_start_time.isoformat(), 
                    'end': local_end_time.isoformat(),
                    'participants': participants,
                    'accepted_participants': accepted_participants,
                    'pending_participants': pending_participants,
                    'declined_participants': declined_participants,
                    'is_pending_for_current_user': is_pending,
                    'event_edit_permission': permission,
                    'version': event.version_number,
                    'cache_number':event.cache_number
                })
    
    return jsonify({
        'updated_events': events_data,
        'deleted_events': deleted_events
    })

# To get the members of the group
@app.route('/members/<int:group_id>')
@login_required
def get_members(group_id):
    if group_id != 1:
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
    
    members = (
        db.session.query(User.name, User.email)
        .join(User.memberships)
        .filter(
            Member.group_id == group_id,
            Member.status == 'Accepted'
        )
        .all()
    )
    
    members_list = [{
        'name': member.name,
        'email': member.email
    } for member in members]
    return jsonify(members_list)

# To get, delete or update the group info
@app.route('/group_info/<int:group_id>', methods=['GET','DELETE','PUT'])
@login_required
def get_info(group_id):
    group = Group.query.filter_by(group_id=group_id).first()
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    if group_id != 1:
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
        permission = mem.permission

    if request.method == 'GET':
        members = (
            db.session.query(User.email, Member.permission, Member.status)
            .join(User.memberships)
            .filter(Member.group_id == group_id)
            .all()
        )
        members_list = [{
            'email': member.email,
            'role': member.permission,
            'status': member.status
        } for member in members]

        return jsonify({
            'version': group.version_number,
            'name': group.group_name,
            'description': group.description,
            'members': members_list,
            'authorization': permission == 'Admin',
            'curr_email': current_user.email
        })
    
    elif request.method == 'DELETE':
        if permission != 'Admin':
            return jsonify({'error': 'Access denied'}), 403
        try:
            Participate.query.filter(
                Participate.event.has(group_id=group_id)
            ).delete(synchronize_session=False)

            Event.query.filter_by(group_id=group_id).delete(synchronize_session=False)

            Member.query.filter_by(group_id=group_id).delete(synchronize_session=False)

            db.session.delete(group)
            db.session.commit()
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to delete group"}), 500
        return jsonify(success=True), 200

    else:
        if permission != 'Admin':
            return jsonify({'error': 'Access denied'}), 403
        group_info = request.get_json()
        try:
            # Check version number
            if group.version_number != group_info['version']:
                return jsonify({'error': "Conflicting Update"}), 409

            # Update basic group info
            group.group_name = group_info['name']
            group.description = group_info['description']
            flag_modified(group, "description")
            
            # Handle member changes
            current_members = {m.user_id: m for m in Member.query.filter_by(group_id=group_id).all()}
            users_cache = {}
            invalid_emails = []
            
            # Process new members
            for new_mem in group_info['new_members']:
                email = new_mem['email'].strip().lower()
                if email not in users_cache:
                    users_cache[email] = User.query.filter_by(email=email).first()
                user = users_cache[email]
                if user:
                    newMember = Member(
                        user_id=user.user_id,
                        group_id=group.group_id,
                        permission=new_mem['role']
                    )
                    db.session.add(newMember)
                else:
                    invalid_emails.append(email)
            
            # Process updated members
            for updated_mem in group_info['updated_members']:
                email = updated_mem['email'].strip().lower()
                if email not in users_cache:
                    users_cache[email] = User.query.filter_by(email=email).first()
                user = users_cache[email]
                if user and user.user_id in current_members:
                    current_members[user.user_id].permission = updated_mem['role']
                    # increment cache_number for all events in this group in which user participates, 
                    db.session.execute(
                        update(Event)
                        .where(
                            Event.group_id == group_id,
                            exists().where(
                                Participate.event_id == Event.event_id,
                                Participate.user_id == user.user_id
                            )
                        )
                        .values(cache_number=Event.cache_number + 1)
                    )
            
            # Process deleted members
            for deleted_mem in group_info['deleted_members']:
                email = deleted_mem['email'].strip().lower()
                if email not in users_cache:
                    users_cache[email] = User.query.filter_by(email=email).first()
                user = users_cache[email]
                if user and user.user_id in current_members:
                    # increment cache_number for all events in this group in which user participates, 
                    db.session.execute(
                        update(Event)
                        .where(
                            Event.group_id == group_id,
                            exists().where(
                                Participate.event_id == Event.event_id,
                                Participate.user_id == user.user_id
                            )
                        )
                        .values(cache_number=Event.cache_number + 1)
                    )
                    Participate.query.filter(
                        Participate.event.has(group_id=group_id),
                        Participate.user_id == user.user_id
                    ).delete(synchronize_session=False)

                    db.session.delete(current_members[user.user_id])
            
            db.session.commit()
            return jsonify({'emails': invalid_emails, 'version': group.version_number}), 200
        
        except StaleDataError:
            db.session.rollback()
            return jsonify({'error': "Conflicting Update"}), 409
        
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to update group info"}), 500

# To get the group permission info
@app.route('/get_group_permission/<int:group_id>', methods=['GET'])
@login_required
def get_group_permission(group_id):
    mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
    if not mem:
        return jsonify({'error': 'Access denied'}), 403
    permission = mem.permission
    return jsonify({'permission':f'${permission}'}), 200

# To add an event
@app.route('/add_event',methods=['POST'])
@login_required
def add_event():
    event = request.get_json()
    
    if int(event['group_id']) != 1:
        # Check if the user has the permission to add the event
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=int(event['group_id'])).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
        permission = mem.permission
        if permission == 'Viewer':
            return jsonify({'error': 'Permission denied'}), 403
     
    newEvent = Event(
        event_name = event['title'],
        description = event['description'],
        start_time = datetime.fromisoformat(event['start']),
        end_time = datetime.fromisoformat(event['end']),
        cache_number = 0,
        creator = current_user.user_id,
        group_id = event['group_id']
    )
    
    participantsEmail = []
    for element in event['participants']:
        participantsEmail.append(element['name'])
    
    # To see whether a Group 1 exits (to validate foreign key)
    group = Group.query.filter_by(group_id=1).first()
    
    if group is None:
        newGroup = Group(
            group_name = 'No Group',
            description = 'No Description'
        )
        
        try:
            db.session.add(newGroup)
            db.session.commit()
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to add event to the database"}), 500
   
    try:
        db.session.add(newEvent)
        db.session.commit()
            
        for participantEmail in participantsEmail:
            participant = Participate(
                user_id = User.query.filter_by(email=participantEmail.strip().lower()).first().user_id,
                event_id = newEvent.event_id
            )
            if participantEmail == current_user.email:
                participant.read_status = 'Read'
                participant.status = 'Accepted'
            db.session.add(participant)
            
        try:
            db.session.commit()
        except:
            db.session.rollback()
            return jsonify({'error': "Unable to add participants"}), 500
    except:
        return jsonify({'error': "Unable to add event to the database"}), 500
    
    return jsonify({'message':'Event added successfully'}), 200

@app.route('/remove_event/<int:event_id>', methods=['DELETE'])
@login_required
def remove_event(event_id):
    event = Event.query.get(event_id)
    if not event:
        return jsonify({'error' : 'Event not found'}), 404

    if event.group_id != 1:
        # Check if the user has the permission to add the event
        mem = Member.query.filter_by(user_id=current_user.user_id, group_id=event.group_id).first()
        if not mem:
            return jsonify({'error': 'Access denied'}), 403
        permission = mem.permission
        if permission == 'Viewer':
            return jsonify({'error': 'Permission denied'}), 403

    try:
        Participate.query.filter(
            Participate.event_id == event_id
        ).delete(synchronize_session=False)

        db.session.delete(event)
        
        db.session.commit()
        return jsonify({'message': 'Event deleted successfully'}), 200
        
    except:
        db.session.rollback()
        return jsonify({'error': "Unable to delete event"}), 500


@app.route('/update_event/<int:event_id>', methods=['PUT'])
@login_required
def update_event(event_id):
    new_event = request.get_json()
    
    event = Event.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error' : 'Event not found'}), 404
    
    if event.version_number != new_event['version']:
        return jsonify({'error': "Conflicting Update"}), 409
    
    if event.group_id == 1:
        try:
            event.event_name = new_event['title']
            event.description = new_event['description']
            event.start_time = datetime.fromisoformat(new_event['start'])
            event.end_time = datetime.fromisoformat(new_event['end'])
            db.session.execute(
                update(Event)
                .where(Event.event_id == event_id)
                .values(cache_number = Event.cache_number + 1)
            )
            db.session.commit() 
            return jsonify({'message': 'Event updated successfully'}), 200
        
        except StaleDataError:
            db.session.rollback()
            return jsonify({'error': "Conflicting Update"}), 409
        
        except:
            db.session.rollback()
            return jsonify({'error' : 'Unable to update event'}), 500
    
    # Check if the user has the permission to add the event
    mem = Member.query.filter_by(user_id=current_user.user_id, group_id=event.group_id).first()
    if not mem:
        return jsonify({'error': 'Access denied'}), 403
    permission = mem.permission
    if permission == 'Viewer':
        return jsonify({'error': 'Permission denied'}), 403
    
    try:
        event.event_name = new_event['title']
        event.description = new_event['description']
        event.start_time = datetime.fromisoformat(new_event['start'])
        event.end_time = datetime.fromisoformat(new_event['end'])
        db.session.execute(
            update(Event)
            .where(Event.event_id == event_id)
            .values(cache_number = Event.cache_number + 1)
        )
        flag_modified(event, "cache_number")

        for email in new_event['added_participants']:
            user = User.query.filter_by(email=email.strip().lower()).first()
            if user:
                participant = Participate(
                    user_id = user.user_id,
                    event_id = event_id
                )
                if user.user_id == current_user.user_id:
                    participant.status = 'Accepted'
                    participant.read_status = 'Read'
                db.session.add(participant)
        
        for email in new_event['changed_participants']:
            user = User.query.filter_by(email=email.strip().lower()).first()
            if user:
                participant = Participate.query.filter_by(user_id=user.user_id, event_id=event_id).first()
                if participant:
                    if user.user_id == current_user.user_id:
                        participant.status = 'Accepted'
                    else:
                        participant.status = 'Pending'
        
        for email in new_event['deleted_participants']:
            user = User.query.filter_by(email=email.strip().lower()).first()
            if user:
                participant = Participate.query.filter_by(user_id=user.user_id, event_id=event_id).first()
                if participant:
                    db.session.delete(participant)

        db.session.commit() 
        return jsonify({'message': 'Event updated successfully'}), 200
    
    except StaleDataError:
            db.session.rollback()
            return jsonify({'error': "Conflicting Update"}), 409
    
    except:
        db.session.rollback()
        return jsonify({'error' : 'Unable to update event'}), 500
    
@app.route('/exit_group/<int:group_id>', methods=['DELETE'])
@login_required
def exit_group(group_id):
    mem = Member.query.filter_by(user_id=current_user.user_id, group_id=group_id).first()
    if mem:
        try:
            if mem.permission == 'Admin':
                admin_count = (
                    db.session.query(func.count(Member.member_id))
                    .filter(
                        Member.group_id == group_id,
                        Member.permission == 'Admin',
                        Member.status == 'Accepted'
                    )
                    .scalar()
                )
                if admin_count == 1:
                    return jsonify({'error' : 'Assign an admin before leaving'}), 400

            Participate.query.filter(
                Participate.event.has(group_id=group_id),
                Participate.user_id == mem.user_id
            ).delete(synchronize_session=False)
            db.session.delete(mem)
            db.session.commit()
        except:
            return jsonify({'error' : 'Unable to exit group'}), 500
    
    return jsonify(success=True), 200