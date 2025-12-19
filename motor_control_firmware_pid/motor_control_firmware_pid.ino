#include <Arduino.h>
#include <math.h>
#define MQTT_MAX_PACKET_SIZE 1024
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

enum DirMode : uint8_t;

static const char* WIFI_SSID     = "YOUR-WIFI-NAME";
static const char* WIFI_PASSWORD = "YOUR-WIFI-PASS";

//MQTT CONFIG for HiveMQ Cloud
static const char* MQTT_HOST     = "YOUR-HIVEMQ-CLOUD-CLUSTER-HOST";
static const int   MQTT_PORT     = 8883;
static const char* MQTT_USER     = "HIVEMQ-USER-CREDENTIALS";
static const char* MQTT_PASSWORD = "HIVEMQ-USER-PASS";

static const char* MQTT_TOPIC    = "motor-driver-telemetry";
static const char* DEVICE_NAME   = "motor-driver-new";

//publish rate limiting
static const uint32_t MQTT_PUBLISH_MS = 3000;

WiFiClientSecure net;
PubSubClient mqtt(net);

static uint32_t bootMs = 0;
static uint32_t lastPubMs = 0;

static void wifiConnect() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 12000) {
    delay(200);
  }
}

static void mqttConnect() {
  if (mqtt.connected()) return;

  net.setInsecure();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024); 
  uint32_t start = millis();
  while (!mqtt.connected() && (millis() - start) < 8000) {
    String clientId = String("esp32-") + DEVICE_NAME + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD);
    delay(250);
  }
}

static inline void mqttPump() {
  if (WiFi.status() != WL_CONNECTED) wifiConnect();
  if (WiFi.status() == WL_CONNECTED) mqttConnect();
  if (mqtt.connected()) mqtt.loop();
}

static inline float clampf(float x, float lo, float hi);

static void publishTelemetrySameJson(
  float targetRPM,          
  float rpmUsed,            
  float pwmCmdAbs,          
  long  deltaCountsSigned,  
  bool  suddenDrop,
  bool  stall,
  bool  overshoot,
  bool  encoderFault
) {
  if (!mqtt.connected()) return;

  uint32_t now = millis();
  if (now - lastPubMs < MQTT_PUBLISH_MS) return;
  lastPubMs = now;

  const float time_s = (now - bootMs) / 1000.0f;

  const float target_rpm = fabsf(targetRPM);
  const float rpm        = fabsf(rpmUsed);

  const float deviation_rpm = fabsf(target_rpm - rpm);
  const float deviation_pct = (target_rpm > 0.001f) ? (deviation_rpm / target_rpm) * 100.0f : 0.0f;

  const int pwm = (int)clampf(fabsf(pwmCmdAbs), 0.0f, 255.0f);
  const float duty_pct = (pwm / 255.0f) * 100.0f;

  const long delta_counts = labs(deltaCountsSigned);
  
const char* status = (suddenDrop || stall || overshoot || encoderFault) ? "ALERT" : "OK";
float rpm_safe = fabsf(rpmUsed);
if (rpm_safe < 0.001f) rpm_safe = 0.0f;

  StaticJsonDocument<512> doc;
  doc["device_name"]   = DEVICE_NAME;
  doc["time_s"]        = time_s;
  doc["target_rpm"]    = target_rpm;
  doc["rpm"]           = rpm;
  doc["deviation_rpm"] = deviation_rpm;
  doc["deviation_pct"] = deviation_pct;
  doc["pwm"]           = pwm;
  doc["duty_pct"]      = duty_pct;
  doc["delta_counts"]  = delta_counts;

  JsonObject flags = doc.createNestedObject("flags");
  flags["sudden_drop"]   = suddenDrop;
  flags["stall"]         = stall;
  flags["overshoot"]     = overshoot;
  flags["encoder_fault"] = encoderFault;
  flags["status"]        = status;

  char out[512];
  size_t n = serializeJson(doc, out, sizeof(out));
  mqtt.publish(MQTT_TOPIC, out, n);
}

#define L_EN   2
#define R_EN   4
#define L_PWM  5
#define R_PWM  33
#define ENC_A  34
#define ENC_B  35
#define POT_PIN 32 //potentionmeter


static const uint32_t PWM_FREQ = 20000; //20 kHz
static const uint8_t  PWM_RES  = 8;     //8 bit duty 0 - 255
static const uint8_t  PWM_CH_L = 0;
static const uint8_t  PWM_CH_R = 1;

//constraints
static const float    COUNTS_PER_REV = 700.0f;
static const uint32_t SAMPLE_MS      = 50;     //20 Hz
static const float    RPM_MAX        = 400.0f;


static const int   ADC_MAX = 4095;
static const float POT_ALPHA = 0.08f;     
static const int   POT_DEADZONE = 200; 

//will be forcing true stop if target below the following
static const float TARGET_STOP_RPM = 10.0f;

//slew limiting nd deadband
static const float TARGET_DEADBAND_RPM     = 1.0f;
static const float TARGET_SLEW_RPM_PER_SEC = 180.0f; //20Hz at approx 9 RPM/tick

// PID gains
static float Kp = 0.6f;
static float Ki = 2.0f;
static float Kd = 0.03f;

//filters
static const float RPM_ALPHA   = 0.25f;   
static const float DERIV_ALPHA = 0.20f;  
static const float DRPM_CLAMP  = 3000.0f; 

static const float PWM_MIN_EFFECTIVE = 25.0f;

//anomaly thresholds for 20Hz windows 
static const float DROP_RPM_THRESHOLD = 80.0f;
static const int   DROP_COUNT_LIMIT   = 6;   

static const float STALL_MIN_PWM      = 100.0f;
static const float STALL_MAX_RPM      = 20.0f;
static const int   STALL_COUNT_LIMIT  = 10;  

static const float OVERSHOOT_FACTOR      = 1.3f;
static const int   OVERSHOOT_COUNT_LIMIT = 10; 

static const int   ZERO_DELTA_COUNT_LIMIT = 10; 
static const float ZERO_DELTA_MIN_PWM     = 100.0f;

//direction mode, serial
enum DirMode : uint8_t { DIR_STOP = 0, DIR_FWD = 1, DIR_REV = 2 };
static volatile DirMode g_dir = DIR_FWD; // default forward


volatile long encoderCount = 0;

//filters
static float potFiltAdc    = 0.0f;
static float targetHoldRpm = 0.0f; 
static float targetRampRpm = 0.0f;  
static float rpmFilt       = 0.0f;  

//PID state
static float integral   = 0.0f;
static float dRpmFilt   = 0.0f;
static float prevRpmRaw = 0.0f; 
//derivative uses raw magnitude

static float pwmCmdAbs = 0.0f;

//anomaly state
static float lastRpmMag = 0.0f;
static int dropCount = 0, stallCount = 0, overshootCount = 0, zeroDeltaCount = 0;

static inline float clampf(float x, float lo, float hi) {
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}

static inline float applyDeadband(float v, float prev, float db) {
  return (fabsf(v - prev) >= db) ? v : prev;
}

static inline float slewLimit(float desired, float current, float maxStep) {
  float diff = clampf(desired - current, -maxStep, maxStep);
  return current + diff;
}

static float mapPotToTargetRpm(float adc) {
  if (adc <= (float)POT_DEADZONE) return 0.0f;

  float norm = (adc - (float)POT_DEADZONE) / (float)(ADC_MAX - POT_DEADZONE); 
  norm = clampf(norm, 0.0f, 1.0f);
  return norm * RPM_MAX;
}

//quadrature direction
void IRAM_ATTR encoderISR() {
  int a = digitalRead(ENC_A);
  int b = digitalRead(ENC_B);
  encoderCount += (a == b) ? 1 : -1;
}

static void motorInit() {
  pinMode(L_EN, OUTPUT);
  pinMode(R_EN, OUTPUT);
  digitalWrite(L_EN, HIGH);
  digitalWrite(R_EN, HIGH);

#if defined(ledcSetup) && defined(ledcAttachPin)
  ledcSetup(PWM_CH_L, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CH_R, PWM_FREQ, PWM_RES);
  ledcAttachPin(L_PWM, PWM_CH_L);
  ledcAttachPin(R_PWM, PWM_CH_R);
  ledcWrite(PWM_CH_L, 0);
  ledcWrite(PWM_CH_R, 0);
#else
  ledcAttach(L_PWM, PWM_FREQ, PWM_RES);
  ledcAttach(R_PWM, PWM_FREQ, PWM_RES);
  ledcWrite(L_PWM, 0);
  ledcWrite(R_PWM, 0);
#endif
}

static inline void pwmWriteL(uint8_t duty) {
#if defined(ledcSetup) && defined(ledcAttachPin)
  ledcWrite(PWM_CH_L, duty);
#else
  ledcWrite(L_PWM, duty);
#endif
}

static inline void pwmWriteR(uint8_t duty) {
#if defined(ledcSetup) && defined(ledcAttachPin)
  ledcWrite(PWM_CH_R, duty);
#else
  ledcWrite(R_PWM, duty);
#endif
}

static inline void motorStop() {
  pwmWriteL(0);
  pwmWriteR(0);
}

static inline void motorDrive(DirMode dir, float pwmAbsFloat) {
  uint8_t duty = (uint8_t)clampf(pwmAbsFloat, 0.0f, 255.0f);

  if (dir == DIR_STOP || duty == 0) {
    motorStop();
    return;
  }

  if (dir == DIR_FWD) {
    pwmWriteR(0);
    pwmWriteL(duty);
  } else { 
    pwmWriteL(0);
    pwmWriteR(duty);
  }
}

static void pollSerialDirection() {
  if (!Serial.available()) return;

  String s = Serial.readStringUntil('\n');
  s.trim();
  s.toUpperCase();

  if (s == "F" || s == "FORWARD" || s == "FWD") {
    g_dir = DIR_FWD;
  } else if (s == "B" || s == "BACK" || s == "BACKWARD" || s == "REV" || s == "REVERSE") {
    g_dir = DIR_REV;
  } else if (s == "S" || s == "STOP" || s == "0") {
    g_dir = DIR_STOP;
  }

  Serial.print("DIR=");
  Serial.println((g_dir == DIR_FWD) ? "FWD" : (g_dir == DIR_REV) ? "REV" : "STOP");
}


void setup() {
  Serial.begin(115200);
  delay(300);

  Serial.println("ESP32 PID Speed Control with Direction via Serial @20Hz");
  Serial.println("Commands: F (forward), B (backward), S (stop)");

  motorInit();

  pinMode(ENC_A, INPUT_PULLUP);
  pinMode(ENC_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC_A), encoderISR, CHANGE);

  pinMode(POT_PIN, INPUT);

  potFiltAdc = (float)analogRead(POT_PIN);
  targetHoldRpm = mapPotToTargetRpm(potFiltAdc);
  targetRampRpm = targetHoldRpm;

  rpmFilt = 0.0f;
  integral = 0.0f;
  dRpmFilt = 0.0f;
  prevRpmRaw = 0.0f;
  pwmCmdAbs = 0.0f;

  bootMs = millis();
  wifiConnect();
  mqttConnect();
}

void loop() {
  pollSerialDirection();

  //keeping cloud alive
  mqttPump();

  static uint32_t lastMs = 0;
  static long lastCount = 0;

  uint32_t nowMs = millis();
  if (nowMs - lastMs < SAMPLE_MS) return;

  float dt = (nowMs - lastMs) / 1000.0f;
  lastMs = nowMs;
  if (dt <= 0.0f || dt > 0.5f) return;


  int potRaw = analogRead(POT_PIN);
  potFiltAdc = (1.0f - POT_ALPHA) * potFiltAdc + POT_ALPHA * (float)potRaw;

  float targetDesired = mapPotToTargetRpm(potFiltAdc);         
  targetHoldRpm = applyDeadband(targetDesired, targetHoldRpm, TARGET_DEADBAND_RPM);

  float maxStep = TARGET_SLEW_RPM_PER_SEC * dt;
  targetRampRpm = slewLimit(targetHoldRpm, targetRampRpm, maxStep);

  float targetRPM = targetRampRpm;                             
  if (targetRPM < TARGET_STOP_RPM) targetRPM = 0.0f;

  //RPM from encoder
  
  long count;
  noInterrupts();
  count = encoderCount;
  interrupts();

  long delta = count - lastCount;
  lastCount = count;

  float revs = (float)delta / COUNTS_PER_REV;
  float rpmRawSigned = (revs / dt) * 60.0f;        
  float rpmRawMag    = fabsf(rpmRawSigned);      

  rpmFilt = (1.0f - RPM_ALPHA) * rpmFilt + RPM_ALPHA * rpmRawMag;
  float rpmUsed = rpmFilt;

  //PID speed control 
  DirMode dir = g_dir;

  if (dir == DIR_STOP || targetRPM == 0.0f) {
    pwmCmdAbs = 0.0f;
    integral = 0.0f;
    dRpmFilt = 0.0f;
    prevRpmRaw = rpmRawMag;
    motorStop();
  } else {
    float error = targetRPM - rpmUsed;        

    float dRpm = (rpmRawMag - prevRpmRaw) / dt;    
    prevRpmRaw = rpmRawMag;

    dRpm = clampf(dRpm, -DRPM_CLAMP, DRPM_CLAMP);
    dRpmFilt = (1.0f - DERIV_ALPHA) * dRpmFilt + DERIV_ALPHA * dRpm;
    integral += error * dt;
    integral = clampf(integral, -300.0f, 300.0f);

    float pTerm = Kp * error;
    float iTerm = Ki * integral;

    //disabling D near very low speeds to avoid jitter
    float dTerm = 0.0f;
    if (targetRPM > 15.0f || rpmUsed > 15.0f) {
      dTerm = -Kd * dRpmFilt;
    }

    float out = pTerm + iTerm + dTerm;
    float outUnclamped = out;

    pwmCmdAbs = clampf(out, 0.0f, 255.0f);

    //stop the integral term from growing when PWM hits its limit
    bool satHigh = (outUnclamped > 255.0f);
    bool satLow  = (outUnclamped < 0.0f);
    if ((satHigh && error > 0.0f) || (satLow && error < 0.0f)) {
      integral -= error * dt;
    }

    //to ensure enough PWM to overcome motor static friction
    if (targetRPM > 20.0f && pwmCmdAbs > 0.0f && pwmCmdAbs < PWM_MIN_EFFECTIVE) {
      pwmCmdAbs = PWM_MIN_EFFECTIVE;
    }

    motorDrive(dir, pwmCmdAbs);
  }

  //anomaly detection
  bool suddenDrop = false, stall = false, overshoot = false, encoderFault = false;

  if (rpmRawMag < lastRpmMag - DROP_RPM_THRESHOLD && pwmCmdAbs > 80.0f) {
    if (++dropCount >= DROP_COUNT_LIMIT) suddenDrop = true;
  } else dropCount = 0;

  if (pwmCmdAbs > STALL_MIN_PWM && rpmRawMag < STALL_MAX_RPM) {
    if (++stallCount >= STALL_COUNT_LIMIT) stall = true;
  } else stallCount = 0;

  if (targetRPM > 5.0f && rpmRawMag > targetRPM * OVERSHOOT_FACTOR && pwmCmdAbs > 20.0f) {
    if (++overshootCount >= OVERSHOOT_COUNT_LIMIT) overshoot = true;
  } else overshootCount = 0;

  if (delta == 0 && pwmCmdAbs > ZERO_DELTA_MIN_PWM) {
    if (++zeroDeltaCount >= ZERO_DELTA_COUNT_LIMIT) encoderFault = true;
  } else zeroDeltaCount = 0;

  lastRpmMag = rpmRawMag;

  publishTelemetrySameJson(
    targetRPM,
    rpmUsed,
    pwmCmdAbs,
    delta,
    suddenDrop,
    stall,
    overshoot,
    encoderFault
  );

  const char* dirStr = (dir == DIR_FWD) ? "FWD" : (dir == DIR_REV) ? "REV" : "STOP";

  Serial.print("DIR=");
  Serial.print(dirStr);

  Serial.print(" | TargetRPM=");
  Serial.print(targetRPM, 1);

  Serial.print(" | RPM=");
  Serial.print(rpmUsed, 1);

  Serial.print(" | dRPM=");
  Serial.print(dRpmFilt, 1);

  Serial.print(" | PWM=");
  Serial.print(pwmCmdAbs, 0);

  Serial.print(" | Flags=");
  if (suddenDrop)   Serial.print("DROP ");
  if (stall)        Serial.print("STALL ");
  if (overshoot)    Serial.print("OVER ");
  if (encoderFault) Serial.print("ENC ");
  if (!(suddenDrop || stall || overshoot || encoderFault)) Serial.print("OK");

  Serial.println();
}