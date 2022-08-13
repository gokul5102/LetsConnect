import json
from flask import jsonify
from flask import Flask, request
import requests
import model

app = Flask(__name__)


@app.route("/")
def home():
    return "Hello World"


@app.route("/ml", methods=["GET", "POST"])
def ml():
    if request.method == "POST":

        request_data = request.data
        request_data = json.loads(request_data.decode("utf-8"))
        # print(request_data)
        matches = model.get_matches(request_data["users"])
        print("Matches")
        print(matches)

    return jsonify(matches)


@app.route("/rej", methods=["GET", "POST"])
def rej():
    if request.method == "POST":
        request_data = request.data
        request_data = json.loads(request_data.decode("utf-8"))

        new_match = model.get_matches(request_data["users"], rej=True)

    return jsonify(new_match)


if __name__ == "__main__":
    app.run(debug=True, port=8000)
