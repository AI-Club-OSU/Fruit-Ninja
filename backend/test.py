import cv2
import mediapipe as mp

BaseOptions = mp.tasks.BaseOptions
from mediapipe.tasks.python.components.containers import Detection

ObjectDetector = mp.tasks.vision.ObjectDetector
ObjectDetectorOptions = mp.tasks.vision.ObjectDetectorOptions
VisionRunningMode = mp.tasks.vision.RunningMode


def print_result(result, image, timestamp):
    print(result)
    print("at: " + str(timestamp))
    return

#parse
def parse_frame(result, image, timestamp):
    return


options = ObjectDetectorOptions(
    base_options = BaseOptions(model_asset_path='efficientdet.tflite'),
    running_mode = VisionRunningMode.LIVE_STREAM,
    max_results=5,
    result_callback=print_result)

detector = ObjectDetector.create_from_options(options)

#for some reason index 0 is my iphone camera not my macbook camera
cap = cv2.VideoCapture(1)
frame_time_stamp_ms = 0
while cap.isOpened():
    print(cap.isOpened())
    success, frame = cap.read()
    if not success:
        break
    
    frame_time_stamp_ms += int(1000 / 30) 

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB),
    )

    detector.detect_async(mp_image, frame_time_stamp_ms)

cap.release()
detector.close()

