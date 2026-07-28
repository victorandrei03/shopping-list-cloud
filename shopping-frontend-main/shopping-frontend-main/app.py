from flask import Flask, render_template

app = Flask(__name__, template_folder="templates")


def render_app(initial_page: str = "dashboard"):
    return render_template("app.html", initial_page=initial_page)


@app.route("/")
def index():
    return render_app("dashboard")


@app.route("/dashboard")
def dashboard():
    return render_app("dashboard")


@app.route("/my-lists")
def my_lists():
    return render_app("my-lists")


@app.route("/shared")
def shared():
    return render_app("my-lists")


@app.route("/notifications")
def notifications():
    return render_app("notifications")


@app.route("/control-center")
def control_center():
    return render_app("control-center")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3001, debug=True)
