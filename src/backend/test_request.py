import requests
import time

URL = "http://127.0.0.1:8001/predict"

data = {
    "CH4_feed": 1000,
    "Steam_to_Carbon": 3.0,
    "SMR_temp": 850,
    "SMR_pressure": 25,
    "HTS_conv": 0.8,
    "PSA_rec": 0.88
}

start = time.time()

response = requests.post(URL, json=data)

end = time.time()

print("Status code:", response.status_code)
print("Response JSON:", response.json())
print("Total request time:", round(end - start, 4), "seconds")