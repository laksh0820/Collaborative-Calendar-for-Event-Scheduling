from flask import Flask
from flask import request, render_template, jsonify
import json

app = Flask(__name__)

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

    with open("events.json", "r") as input_data:
        return input_data.read()
    
# Load existing events from the file (if it exists)
def load_events():
    with open("events.json", 'r') as file:
        return json.load(file)
    
# Save events to the file
def save_events(events):
    with open("events.json", 'w') as file:
        json.dump(events, file, indent=4)

@app.route('/add_event',methods=['POST'])
def add_event():
    new_event = request.get_json()
    events = load_events()
    events.append(new_event)
    save_events(events)
    return jsonify(success=True)

if __name__ == '__main__':
    app.run(debug=True)