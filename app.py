from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime
import traceback
from flask_migrate import Migrate
import os

if os.path.exists("tasks.db"):
    os.remove("tasks.db")
    print("tasks.db deleted")
else:
    print("tasks.db not found")

# ------------------------
# App Setup
# ------------------------

app = Flask(__name__, static_folder="static", template_folder="templates")


# Allow all origins for API routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configure database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///tasks.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database object
db = SQLAlchemy(app)
migrate = Migrate(app, db)
# ------------------------
# Database Model
# ------------------------
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    due_date = db.Column(db.String(10))     # YYYY-MM-DD
    due_time = db.Column(db.String(5))      # HH:MM
    priority = db.Column(db.String(10))
    completed = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id,
            'text': self.text,
            'dueDate': self.due_date,
            'dueTime': self.due_time,
            'priority': self.priority,
            'completed': self.completed
        }

# ------------------------
# Create database tables
# ------------------------
with app.app_context():
    db.create_all()

# ------------------------
# Routes
# ------------------------

@app.route('/')
def index():
    return render_template('index.html')

# Get all tasks
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    try:
        tasks = Task.query.all()
        return jsonify([t.to_dict() for t in tasks])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Add new task
@app.route('/api/tasks', methods=['POST'])
def add_task():
    try:
        if not request.is_json:
            return jsonify({'error': 'Expected application/json'}), 400

        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400

        # Validate due date
        due_date = data.get('dueDate')
        if due_date:
            try:
                datetime.fromisoformat(due_date)
            except ValueError:
                return jsonify({'error': 'Invalid dueDate format; use YYYY-MM-DD'}), 400

        # Validate due time
        due_time = data.get('dueTime')
        if due_time:
            try:
                datetime.strptime(due_time, '%H:%M')
            except ValueError:
                return jsonify({'error': 'Invalid dueTime format; use HH:MM'}), 400

        new_task = Task(
            text=data['text'],
            due_date=due_date,
            due_time=due_time,
            priority=data.get('priority', 'medium'),
            completed=False
        )
        db.session.add(new_task)
        db.session.commit()

        return jsonify(new_task.to_dict()), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Update existing task
@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    try:
        if not request.is_json:
            return jsonify({'error': 'Expected application/json'}), 400

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Empty JSON body'}), 400

        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        # Update only the provided fields
        if 'text' in data:
            task.text = data['text']

        if 'dueDate' in data:
            if data['dueDate']:
                try:
                    datetime.fromisoformat(data['dueDate'])
                    task.due_date = data['dueDate']
                except ValueError:
                    return jsonify({'error': 'Invalid dueDate format; use YYYY-MM-DD'}), 400
            else:
                task.due_date = None

        if 'dueTime' in data:
            if data['dueTime']:
                try:
                    datetime.strptime(data['dueTime'], '%H:%M')
                    task.due_time = data['dueTime']
                except ValueError:
                    return jsonify({'error': 'Invalid dueTime format; use HH:MM'}), 400
            else:
                task.due_time = None

        if 'priority' in data:
            task.priority = data['priority']

        if 'completed' in data:
            task.completed = bool(data['completed'])

        db.session.commit()
        return jsonify(task.to_dict()), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    
# Delete task
@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        task = Task.query.get(task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404
        
        db.session.delete(task)
        db.session.commit()
        
        return jsonify({'message': 'Task deleted successfully'}), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500    

# ------------------------
# Run the app
# ------------------------
if __name__ == '__main__':
    app.run(debug=True)
