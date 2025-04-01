from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField,TextAreaField,BooleanField,SelectMultipleField
from wtforms.validators import DataRequired,EqualTo,Email,Length,Regexp,Optional

MIN_PASSWORD_LEN = 8
MAX_PASSWORD_LEN = 12

class SignUpForm(FlaskForm):
    name = StringField("Name",validators=[DataRequired(), Length(max=200)])
    email = StringField("Email",validators=[DataRequired(), Length(max=500)])
    password = PasswordField("Password",validators=[DataRequired(), Length(min=MIN_PASSWORD_LEN,max=MAX_PASSWORD_LEN)])
    confirm_password = PasswordField("Confirm-Password",validators=[DataRequired(), Length(min=MIN_PASSWORD_LEN,max=MAX_PASSWORD_LEN)])
    submit = SubmitField("Submit")

class SignInForm(FlaskForm):
    email = StringField("Email",validators=[DataRequired(),
                                            Email(message="Invalid email address"),
                                            Length(max=500)])
    password = PasswordField("Password",validators=[DataRequired()])
    remember_me = BooleanField("Remember Me")
    submit = SubmitField("Submit")

class GroupForm(FlaskForm):
    name = StringField('Group Name', validators=[DataRequired(), Length(max=200)])
    description = TextAreaField('Description', validators=[Optional(), Length(max=1000)])
    participants = SelectMultipleField(
        'Select Participants',
        coerce=int,
        validators=[DataRequired()]
    )
    submit = SubmitField('Save')