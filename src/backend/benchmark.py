import requests
import time

URL = "http://127.0.0.1:8001/predict"

success = 0
total_requests = 100

start_time = time.time()

for i in range(total_requests):
    try:
        response = requests.post(
            URL,
            json={
                "CH4_feed": 100.0,
                "Steam_to_Carbon": 2.8,
                "SMR_temp": 850.0,
                "SMR_pressure": 30.0,
                "HTS_conv": 0.75,
                "PSA_rec": 0.95
            }
        )

        if response.status_code == 200:
            success += 1

    except Exception as e:
        print(f"Request {i+1} failed: {e}")

end_time = time.time()

success_rate = (success / total_requests) * 100
total_duration = end_time - start_time
avg_latency = total_duration / total_requests

print(f"Successful requests: {success}")
print(f"Success rate: {success_rate}%")
print(f"Total time: {total_duration:.4f} seconds")
print(f"Average latency per request: {avg_latency:.4f} seconds")