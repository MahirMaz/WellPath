-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: wellpath_health
-- ------------------------------------------------------
-- Server version	8.0.34

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `wellpath_health`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `wellpath_health` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `wellpath_health`;

--
-- Table structure for table `access_audit_log`
--

DROP TABLE IF EXISTS `access_audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `access_audit_log` (
  `audit_id` bigint NOT NULL AUTO_INCREMENT,
  `accessed_by_user_id` int NOT NULL,
  `patient_id` int DEFAULT NULL,
  `table_name` varchar(80) NOT NULL,
  `access_type` enum('SELECT','INSERT','UPDATE','DELETE') NOT NULL,
  `access_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`),
  KEY `accessed_by_user_id` (`accessed_by_user_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `access_audit_log_ibfk_1` FOREIGN KEY (`accessed_by_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `access_audit_log_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `access_audit_log`
--

LOCK TABLES `access_audit_log` WRITE;
/*!40000 ALTER TABLE `access_audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `access_audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ai_insight_cache`
--

DROP TABLE IF EXISTS `ai_insight_cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_insight_cache` (
  `patient_id` int NOT NULL,
  `insight_type` varchar(20) NOT NULL,
  `target_id` varchar(50) NOT NULL,
  `data_hash` char(64) NOT NULL,
  `insight_text` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`patient_id`,`insight_type`,`target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_insight_cache`
--

LOCK TABLES `ai_insight_cache` WRITE;
/*!40000 ALTER TABLE `ai_insight_cache` DISABLE KEYS */;
INSERT INTO `ai_insight_cache` VALUES (1,'kpi','activeMinutes','997e7ec6d68a15462d011c3221ed13cc41ffc2d750c4a341e30e584ba78f65a0','You\'re close to reaching your daily active minutes goal, but your activity levels have been trending downward over the past week. Consider taking a 10-minute walk after dinner each evening to boost your daily activity.','2026-07-14 19:58:21'),(1,'kpi','bloodPressure','e89d7b70801dc1a69aa6ad50080445c82bff271e2b0418e497d7727481b62f19','Your blood pressure remains within the target range, but it\'s slightly elevated compared to your baseline. Consider reviewing your reading under similar conditions with a clinician to confirm this pattern.','2026-07-14 19:57:25'),(1,'kpi','calories','cde89203fa75175e9b480184f734e6005cbf247bb4419ae1fb0331f78b71ef24','You\'re consistently burning above your weekly average of active calories, which is a great sign. To keep this momentum, try adding a 10-minute walk to your daily routine, 3 times a week, to boost your calorie burn even further.','2026-07-14 19:57:53'),(1,'kpi','exercise','a79b74f47d45ec6b98a24bb43c06b1194f0785c35e5a61a12e48f19638c7ca77','You\'ve had a strong week for exercise, exceeding your daily goal and weekly total. To maintain this momentum, try incorporating a 10-minute walk into your daily routine, ideally 3-4 times a week.','2026-07-14 19:58:07'),(1,'kpi','heartRate','4657d5e10dfa5809807279e2b76069aa0d0efecc9bbe258334ef67f52b287dd6','Your resting heart rate has been steady within its baseline range of 60-72 bpm. To continue monitoring this trend, consider rechecking your resting heart rate under similar conditions to confirm consistency.','2026-07-14 19:57:07'),(1,'kpi','recovery','354d11872a37de03e36ed6f90018861eaabff0221922739a89b54995394c4988','You\'re doing well with your recovery, maintaining an excellent score. To further support your readiness, aim for a consistent sleep schedule by establishing a relaxing bedtime routine, such as reading a book for 15 minutes, 30 minutes before your usual bedtime.','2026-07-14 19:56:49'),(1,'kpi','sedentary','0b2e8481be9d12b288a99671fe816bc883fc91a43e56d429ee0e55a336bf73b1','You\'re doing well in managing your sedentary time, staying within your daily limit of 8 hours. To build on this, try taking a 10-minute standing break every hour to stay active throughout the day.','2026-07-14 19:57:42'),(1,'kpi','sleep','598086f9c95256ba46e7f89404615555be4a980ebc78cbb63418f6a5d3d73272','You\'re getting a good amount of sleep, but there\'s room to improve your consistency. Try establishing a relaxing bedtime routine, like reading a book for 10-15 minutes, to help you wind down and prepare for bed.','2026-07-14 19:56:47'),(1,'kpi','steps','5cb9adc67af16eb9fe31e4adddfe174af016c9e74441d7adeabb08957d76ed7b','You\'re close to reaching your daily step goal, but your 7-day average has been trending downward. Take a 10-minute walk today to get back on track and maintain your momentum.\n\nYou\'re doing great, keep it up!','2026-07-14 19:56:47'),(1,'score','activity','865e981ab9ce3a147ae02fa43b007791fe141638ef895030bbea9ffaee5874bd','You\'re doing great with your daily activity, scoring 96 out of 100. To maintain this excellent status, try fitting in a 10-minute walk during your lunch break, 3 times a week, to boost your overall movement.','2026-07-14 19:56:58'),(1,'score','consistency','f9dc2a556ab32e7226ff134c6b743ae6e7e40837b97e3dfe0133981fd55e06df','You\'re doing great with maintaining a consistent routine, with an overall Consistency Score of 88, indicating an Excellent status. To keep this momentum, try scheduling a 10-minute walk each morning to start your day on a consistent note.','2026-07-14 19:56:54'),(1,'score','wellpath','69cb7377b5a40c6553c133582d21764e2bcda29e0926d668f5ddab394f00dd4c','Your overall wellness score is excellent, with a score of 97. To maintain this level, focus on a consistent sleep schedule by establishing a relaxing bedtime routine, such as reading a book for 10 minutes before bed, to help you wind down each night.','2026-07-14 19:56:47'),(2,'kpi','activeMinutes','ab050016cb4a3564c61dd4688b89dfafdb28b13aca483d64a5fca4b7fc3b0fca','You\'re averaging 20 minutes of active minutes per day, which is below your daily target of 55 minutes. To boost your active minutes, try taking a 10-minute walk after dinner each night.','2026-07-14 21:14:11'),(2,'kpi','bloodPressure','c2f96c4f860c93ee9c0ad5705e282f62061ef234341e543d3d58ec12f4fb6043','Your blood pressure is slightly above the target range, with a recent average of 141/93 mmHg. Consider reviewing a persistent pattern with your clinician to ensure there are no underlying concerns.','2026-07-14 21:12:36'),(2,'kpi','calories','20be7ef41f9d0dabe74242004bf4b94465156c46a72fa7f60305e4b57282ca08','You\'re burning fewer calories than usual, which may indicate a need to increase physical activity. Start with a 10-minute brisk walk after dinner to boost your daily calorie burn.','2026-07-14 21:13:24'),(2,'kpi','exercise','5619705f904aa01fbf713b97c3c7764acb98662500cf4516355cbf66b983885f','You\'re not meeting your daily exercise goal, and your weekly total is below average. Try adding a 10-minute walk to your daily routine, 3 times this week.','2026-07-14 21:13:55'),(2,'kpi','heartRate','dd8dc17d4971365911667b9249aa39e4595dafa515c2d7e8fcba41be290dfb64','Your resting heart rate is slightly above your personal baseline, but trending downward. Recheck your resting heart rate under similar conditions to confirm this improvement and discuss with a clinician if it persists.','2026-07-14 21:12:20'),(2,'kpi','recovery','a83bd76a51cfe2f26ac578f64a9e9876d6edbdab6821bdd0db7c1a1c9b6a7b5e','Your sleep consistency and resting heart rate are the biggest drags right now — start with a 30-minute wind-down before a steady, earlier bedtime and aim for 10-15 minutes of gentle stretching each morning to help regulate your heart rate.','2026-07-14 21:14:43'),(2,'kpi','sedentary','fe5c698057fdf31be5fe236207dce07844f432e65427e354e0192926e14fee58','You\'ve been sitting for over 11 hours today, exceeding your daily limit of 8 hours. Try taking a 3-5 minute standing break every hour to stay active.','2026-07-14 21:12:52'),(2,'kpi','sleep','18b49c54d4551b743748da298dbdb96a499c7c4e93a6c5a4c449a33a2a0ff95d','You\'re averaging 4.7 hours of sleep per night, which is close to your goal, but you\'re consistently going to bed late. Try going to bed 30 minutes earlier tonight to establish a more consistent sleep schedule.','2026-07-14 21:12:16'),(2,'kpi','steps','b86c9d18e01e7ae854cc21e0d37dc42a5329c42426b28a13d530c51552a9b105','You\'re averaging 4,442 steps per day, which is below your target of 9,000. To get closer to your goal, start with a 10-minute walk after dinner tonight.','2026-07-14 21:12:17'),(2,'score','activity','45d00daf06b0d703b9a780e8eb3e1dc147a78bf23d244115b6b4f20a207cb6bd','Your low exercise minutes and long sedentary time are the biggest drags right now — aim for a 10-minute walk after each meal to increase your daily movement.','2026-07-14 21:13:39'),(2,'score','consistency','9a0f4255e66f876b2421196dbe09e4dc141309abc72ee360a55ac4b97c7762c7','Your sleep consistency and sedentary-time consistency are the biggest drags right now — start with a consistent 30-minute bedtime routine to establish a steady sleep schedule.','2026-07-14 21:14:27'),(2,'score','wellpath','0cbc16794b567adf10734e431254af55d227cdb1e265af291422e993c091eb94','Your inconsistent sleep and excessive sedentary time are the biggest drags right now — start with a 30-minute wind-down before a steady, earlier bedtime.','2026-07-14 21:12:16');
/*!40000 ALTER TABLE `ai_insight_cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alerts`
--

DROP TABLE IF EXISTS `alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alerts` (
  `alert_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `alert_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `alert_type` varchar(80) NOT NULL,
  `alert_level` enum('info','low','medium','high') NOT NULL,
  `alert_message` text NOT NULL,
  `resolved_status` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`alert_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `alerts_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alerts`
--

LOCK TABLES `alerts` WRITE;
/*!40000 ALTER TABLE `alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `care_assignments`
--

DROP TABLE IF EXISTS `care_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `care_assignments` (
  `assignment_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `clinician_user_id` int DEFAULT NULL,
  `trainer_user_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  PRIMARY KEY (`assignment_id`),
  KEY `patient_id` (`patient_id`),
  KEY `clinician_user_id` (`clinician_user_id`),
  KEY `trainer_user_id` (`trainer_user_id`),
  CONSTRAINT `care_assignments_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`),
  CONSTRAINT `care_assignments_ibfk_2` FOREIGN KEY (`clinician_user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `care_assignments_ibfk_3` FOREIGN KEY (`trainer_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `care_assignments`
--

LOCK TABLES `care_assignments` WRITE;
/*!40000 ALTER TABLE `care_assignments` DISABLE KEYS */;
INSERT INTO `care_assignments` VALUES (1,1,7,6,'2026-01-15',NULL),(2,2,7,6,'2026-02-01',NULL),(3,3,7,6,'2026-03-10',NULL),(4,4,7,6,'2026-04-05',NULL),(5,5,7,6,'2026-05-01',NULL);
/*!40000 ALTER TABLE `care_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goals`
--

DROP TABLE IF EXISTS `goals`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `goals` (
  `goal_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `goal_text` text NOT NULL,
  `goal_status` enum('planned','in_progress','completed') NOT NULL DEFAULT 'planned',
  `target_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`goal_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `goals_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goals`
--

LOCK TABLES `goals` WRITE;
/*!40000 ALTER TABLE `goals` DISABLE KEYS */;
INSERT INTO `goals` VALUES (1,1,'Walk 10,000 steps at least 5 days this week','in_progress','2026-07-21','2026-07-14 20:35:15'),(2,1,'Sleep 7 hours for the next 3 nights','in_progress','2026-07-21','2026-07-14 20:35:15'),(3,1,'Complete three 45-minute workouts','planned','2026-07-21','2026-07-14 20:35:15'),(4,1,'Review history signals every Friday','planned','2026-07-21','2026-07-14 20:35:15'),(5,2,'Walk 10,000 steps at least 5 days this week','in_progress','2026-07-21','2026-07-14 20:35:15'),(6,2,'Sleep 7 hours for the next 3 nights','in_progress','2026-07-21','2026-07-14 20:35:15'),(7,2,'Complete three 45-minute workouts','planned','2026-07-21','2026-07-14 20:35:15'),(8,2,'Review history signals every Friday','planned','2026-07-21','2026-07-14 20:35:15'),(9,3,'Walk 10,000 steps at least 5 days this week','in_progress','2026-07-21','2026-07-14 20:35:15'),(10,3,'Sleep 7 hours for the next 3 nights','in_progress','2026-07-21','2026-07-14 20:35:15'),(11,3,'Complete three 45-minute workouts','planned','2026-07-21','2026-07-14 20:35:15'),(12,3,'Review history signals every Friday','planned','2026-07-21','2026-07-14 20:35:15'),(13,4,'Walk 10,000 steps at least 5 days this week','in_progress','2026-07-21','2026-07-14 20:35:15'),(14,4,'Sleep 7 hours for the next 3 nights','in_progress','2026-07-21','2026-07-14 20:35:15'),(15,4,'Complete three 45-minute workouts','planned','2026-07-21','2026-07-14 20:35:15'),(16,4,'Review history signals every Friday','planned','2026-07-21','2026-07-14 20:35:15'),(17,5,'Walk 10,000 steps at least 5 days this week','in_progress','2026-07-21','2026-07-14 20:35:15'),(18,5,'Sleep 7 hours for the next 3 nights','in_progress','2026-07-21','2026-07-14 20:35:15'),(19,5,'Complete three 45-minute workouts','planned','2026-07-21','2026-07-14 20:35:15'),(20,5,'Review history signals every Friday','planned','2026-07-21','2026-07-14 20:35:15');
/*!40000 ALTER TABLE `goals` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kpi_types`
--

DROP TABLE IF EXISTS `kpi_types`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kpi_types` (
  `kpi_type_id` int NOT NULL AUTO_INCREMENT,
  `kpi_name` varchar(100) NOT NULL,
  `role_view` enum('patient','trainer','clinician') NOT NULL,
  `unit` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`kpi_type_id`),
  UNIQUE KEY `kpi_name` (`kpi_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kpi_types`
--

LOCK TABLES `kpi_types` WRITE;
/*!40000 ALTER TABLE `kpi_types` DISABLE KEYS */;
INSERT INTO `kpi_types` VALUES (1,'Health Score','patient','score'),(2,'Risk Score','clinician','score'),(3,'Activity Consistency','trainer','%'),(4,'Recovery Score','patient','score');
/*!40000 ALTER TABLE `kpi_types` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_daily_health_fact`
--

DROP TABLE IF EXISTS `patient_daily_health_fact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_daily_health_fact` (
  `daily_health_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `record_date` date NOT NULL,
  `steps` int DEFAULT NULL,
  `sleep_hours` decimal(4,2) DEFAULT NULL,
  `sleep_bedtime` time DEFAULT NULL,
  `sleep_wake_time` time DEFAULT NULL,
  `sleep_interruptions` int DEFAULT NULL,
  `sleep_consistency` decimal(5,2) DEFAULT NULL,
  `resting_heart_rate` int DEFAULT NULL,
  `exercise_minutes` int DEFAULT NULL,
  `systolic_bp` int DEFAULT NULL,
  `diastolic_bp` int DEFAULT NULL,
  `bmi` decimal(5,2) DEFAULT NULL,
  `calories_burned` int DEFAULT NULL,
  `active_calories` int DEFAULT NULL,
  `active_minutes` int DEFAULT NULL,
  `workout_count` int DEFAULT NULL,
  `workout_intensity` varchar(20) DEFAULT NULL,
  `diet_score` int DEFAULT NULL,
  `stress_level` int DEFAULT NULL,
  `sedentary_hours` decimal(4,2) DEFAULT NULL,
  `longest_inactive_minutes` int DEFAULT NULL,
  `data_source` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`daily_health_id`),
  UNIQUE KEY `patient_id` (`patient_id`,`record_date`),
  CONSTRAINT `patient_daily_health_fact_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`)
) ENGINE=InnoDB AUTO_INCREMENT=151 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_daily_health_fact`
--

LOCK TABLES `patient_daily_health_fact` WRITE;
/*!40000 ALTER TABLE `patient_daily_health_fact` DISABLE KEYS */;
INSERT INTO `patient_daily_health_fact` VALUES (1,1,'2026-06-01',9027,7.10,'23:15:00','06:10:00',0,91.20,67,48,115,75,23.00,2460,703,50,4,'Moderate',8,4,4.90,108,'wearable','2026-07-14 20:35:15'),(2,1,'2026-06-02',8915,7.10,'22:45:00','05:50:00',0,93.20,68,51,114,74,23.00,2474,799,61,4,'Moderate',8,3,5.50,121,'manual','2026-07-14 20:35:15'),(3,1,'2026-06-03',9775,7.10,'23:05:00','06:05:00',0,95.20,67,59,118,76,23.00,2576,760,51,4,'Moderate',8,3,4.00,88,'wearable','2026-07-14 20:35:15'),(4,1,'2026-06-04',9088,7.60,'23:30:00','06:35:00',0,96.80,66,53,116,74,23.00,2519,786,58,4,'Moderate',8,2,4.80,106,'manual','2026-07-14 20:35:15'),(5,1,'2026-06-05',8873,7.50,'22:40:00','05:45:00',0,96.00,66,52,115,74,23.00,2523,849,67,4,'Moderate',9,3,5.20,114,'wearable','2026-07-14 20:35:15'),(6,1,'2026-06-06',9201,7.00,'23:00:00','06:15:00',0,88.00,66,58,116,75,23.00,2544,853,64,4,'Vigorous',8,4,5.30,117,'manual','2026-07-14 20:35:15'),(7,1,'2026-06-07',9351,7.50,'22:50:00','05:55:00',0,94.00,64,63,115,73,23.00,2525,876,64,4,'Vigorous',8,3,4.60,101,'wearable','2026-07-14 20:35:15'),(8,1,'2026-06-08',8859,7.70,'23:15:00','06:10:00',0,93.60,65,54,117,73,23.00,2502,717,52,3,'Moderate',8,2,5.50,121,'manual','2026-07-14 20:35:15'),(9,1,'2026-06-09',9303,7.30,'22:45:00','05:50:00',0,95.60,67,54,116,76,23.00,2514,775,56,4,'Moderate',8,3,5.30,117,'wearable','2026-07-14 20:35:15'),(10,1,'2026-06-10',9569,7.40,'23:05:00','06:05:00',0,98.80,66,52,118,74,23.00,2428,746,57,3,'Moderate',8,5,4.40,97,'manual','2026-07-14 20:35:15'),(11,1,'2026-06-11',9185,7.40,'23:30:00','06:35:00',0,96.80,66,58,116,76,23.00,2494,786,55,4,'Vigorous',8,4,5.50,121,'wearable','2026-07-14 20:35:15'),(12,1,'2026-06-12',9874,8.00,'22:40:00','05:45:00',0,90.00,65,57,115,74,23.00,2451,847,60,5,'Vigorous',9,4,4.00,88,'manual','2026-07-14 20:35:15'),(13,1,'2026-06-13',10136,7.60,'23:00:00','06:15:00',0,92.80,64,55,114,76,23.00,2482,892,71,4,'Vigorous',9,3,3.90,86,'wearable','2026-07-14 20:35:15'),(14,1,'2026-06-14',10342,7.20,'22:50:00','05:55:00',0,90.40,66,52,116,76,23.00,2455,753,58,3,'Moderate',9,3,4.30,95,'manual','2026-07-14 20:35:15'),(15,1,'2026-06-15',9349,7.60,'23:15:00','06:10:00',0,94.80,67,58,114,75,23.00,2578,808,58,4,'Vigorous',8,3,5.90,130,'wearable','2026-07-14 20:35:15'),(16,1,'2026-06-16',9164,7.00,'22:45:00','05:50:00',0,92.00,67,50,115,75,23.00,2423,750,55,4,'Moderate',8,3,5.20,114,'manual','2026-07-14 20:35:15'),(17,1,'2026-06-17',9456,7.80,'23:05:00','06:05:00',0,96.40,65,55,117,74,23.00,2552,797,62,3,'Vigorous',7,3,5.10,112,'wearable','2026-07-14 20:35:15'),(18,1,'2026-06-18',9670,7.90,'23:30:00','06:35:00',0,93.20,67,58,115,76,23.00,2439,868,66,4,'Vigorous',7,3,4.90,108,'manual','2026-07-14 20:35:15'),(19,1,'2026-06-19',10016,7.10,'22:40:00','05:45:00',0,91.20,65,53,117,75,23.00,2483,831,64,4,'Moderate',7,3,4.10,90,'wearable','2026-07-14 20:35:15'),(20,1,'2026-06-20',9958,7.70,'23:00:00','06:15:00',0,91.60,65,64,116,74,23.00,2473,880,64,4,'Vigorous',9,4,3.80,84,'manual','2026-07-14 20:35:15'),(21,1,'2026-06-21',9194,6.90,'22:50:00','05:55:00',0,86.80,65,51,115,74,23.00,2504,769,57,4,'Moderate',7,2,4.70,103,'wearable','2026-07-14 20:35:15'),(22,1,'2026-06-22',8813,7.70,'23:15:00','06:10:00',0,93.60,66,58,115,76,23.00,2473,786,55,4,'Vigorous',8,3,5.60,123,'manual','2026-07-14 20:35:15'),(23,1,'2026-06-23',9562,7.80,'22:45:00','05:50:00',0,94.40,67,61,117,75,23.00,2469,889,67,4,'Vigorous',8,3,5.50,121,'wearable','2026-07-14 20:35:15'),(24,1,'2026-06-24',9336,7.60,'23:05:00','06:05:00',0,98.80,67,65,114,75,23.00,2497,795,52,4,'Moderate',9,4,5.50,121,'manual','2026-07-14 20:35:15'),(25,1,'2026-06-25',9512,7.30,'23:30:00','06:35:00',0,95.60,66,60,114,74,23.00,2569,810,57,4,'Vigorous',7,2,4.90,108,'wearable','2026-07-14 20:35:15'),(26,1,'2026-06-26',9762,7.10,'22:40:00','05:45:00',0,91.20,65,54,114,75,23.00,2521,828,63,4,'Moderate',8,4,4.00,88,'manual','2026-07-14 20:35:15'),(27,1,'2026-06-27',9730,8.00,'23:00:00','06:15:00',0,88.00,65,61,115,75,23.00,2519,874,65,4,'Vigorous',9,2,4.00,88,'wearable','2026-07-14 20:35:15'),(28,1,'2026-06-28',9775,7.50,'22:50:00','05:55:00',0,94.00,66,53,118,75,23.00,2523,836,61,5,'Moderate',9,2,4.80,106,'manual','2026-07-14 20:35:15'),(29,1,'2026-06-29',10145,7.50,'23:15:00','06:10:00',0,96.00,66,47,114,75,23.00,2531,809,61,5,'Moderate',8,2,5.30,117,'wearable','2026-07-14 20:35:15'),(30,1,'2026-06-30',9062,7.50,'22:45:00','05:50:00',0,98.00,66,59,117,75,23.00,2475,820,59,4,'Vigorous',7,2,5.10,112,'manual','2026-07-14 20:35:15'),(31,2,'2026-06-01',4025,5.40,'22:45:00','05:50:00',3,48.80,84,17,142,95,28.90,1868,195,12,1,'Light',4,8,10.70,240,'wearable','2026-07-14 20:35:15'),(32,2,'2026-06-02',4909,4.20,'23:05:00','06:05:00',3,36.40,84,5,141,94,28.90,1855,195,23,0,'Light',3,8,9.50,240,'manual','2026-07-14 20:35:15'),(33,2,'2026-06-03',3293,4.40,'23:30:00','06:35:00',3,36.80,87,0,142,92,29.00,1771,180,12,1,'None',3,7,11.80,240,'wearable','2026-07-14 20:35:15'),(34,2,'2026-06-04',3729,5.30,'22:40:00','05:45:00',3,45.60,84,18,142,92,28.90,1776,297,25,1,'Light',4,8,10.90,240,'manual','2026-07-14 20:35:15'),(35,2,'2026-06-05',4321,4.80,'23:00:00','06:15:00',3,37.60,85,16,142,92,28.90,1796,220,16,1,'Light',4,8,11.00,240,'wearable','2026-07-14 20:35:15'),(36,2,'2026-06-06',3957,5.10,'22:50:00','05:55:00',3,41.20,85,17,142,91,28.90,1871,255,20,1,'Light',5,7,11.50,240,'manual','2026-07-14 20:35:15'),(37,2,'2026-06-07',4474,5.20,'23:15:00','06:10:00',3,44.40,84,12,142,93,29.00,1845,180,11,0,'Light',4,8,9.80,240,'wearable','2026-07-14 20:35:15'),(38,2,'2026-06-08',4723,4.70,'22:45:00','05:50:00',3,40.40,85,8,144,91,28.90,1894,192,17,1,'Light',4,8,10.40,240,'manual','2026-07-14 20:35:15'),(39,2,'2026-06-09',4676,4.20,'23:05:00','06:05:00',3,36.40,86,11,143,92,28.90,1831,200,20,0,'Light',4,9,10.10,240,'wearable','2026-07-14 20:35:15'),(40,2,'2026-06-10',4008,5.00,'23:30:00','06:35:00',3,44.00,86,14,142,92,28.90,1863,284,22,2,'Light',4,8,11.10,240,'manual','2026-07-14 20:35:15'),(41,2,'2026-06-11',4664,4.20,'22:40:00','05:45:00',3,35.00,84,10,145,93,28.90,1805,206,14,2,'Light',4,8,9.60,240,'wearable','2026-07-14 20:35:15'),(42,2,'2026-06-12',4582,4.40,'23:00:00','06:15:00',3,35.00,86,19,141,94,28.90,1786,264,20,1,'Light',5,8,10.10,240,'manual','2026-07-14 20:35:15'),(43,2,'2026-06-13',3817,5.30,'22:50:00','05:55:00',3,43.60,84,14,140,94,28.90,1726,196,14,1,'Light',4,9,11.20,240,'wearable','2026-07-14 20:35:15'),(44,2,'2026-06-14',3975,5.10,'23:15:00','06:10:00',3,43.20,84,17,140,94,28.90,1722,240,18,1,'Light',3,7,9.80,240,'manual','2026-07-14 20:35:15'),(45,2,'2026-06-15',5074,5.30,'22:45:00','05:50:00',3,47.60,83,18,144,93,28.90,1875,244,18,1,'Light',4,7,9.70,240,'wearable','2026-07-14 20:35:15'),(46,2,'2026-06-16',3737,4.60,'23:05:00','06:05:00',3,41.20,85,18,143,93,28.90,1759,229,16,1,'Light',5,7,11.20,240,'manual','2026-07-14 20:35:15'),(47,2,'2026-06-17',3172,4.80,'23:30:00','06:35:00',3,41.60,86,11,142,93,28.90,1810,183,14,1,'Light',4,8,11.20,240,'wearable','2026-07-14 20:35:15'),(48,2,'2026-06-18',4371,4.80,'22:40:00','05:45:00',3,39.60,85,15,141,94,28.90,1916,298,27,1,'Light',4,8,10.40,240,'manual','2026-07-14 20:35:15'),(49,2,'2026-06-19',3819,4.50,'23:00:00','06:15:00',3,35.00,84,16,142,92,28.90,1925,213,15,1,'Light',4,8,10.00,240,'wearable','2026-07-14 20:35:15'),(50,2,'2026-06-20',3428,4.70,'22:50:00','05:55:00',3,36.40,87,10,142,94,28.90,1777,223,20,1,'Light',4,7,11.50,240,'manual','2026-07-14 20:35:15'),(51,2,'2026-06-21',3993,4.80,'23:15:00','06:10:00',3,39.60,85,16,140,91,28.90,1871,228,17,1,'Light',3,8,10.50,240,'wearable','2026-07-14 20:35:15'),(52,2,'2026-06-22',3703,4.30,'22:45:00','05:50:00',3,35.60,87,12,144,93,28.90,1680,262,24,1,'Light',4,8,10.90,240,'manual','2026-07-14 20:35:15'),(53,2,'2026-06-23',4698,4.50,'23:05:00','06:05:00',3,40.00,85,0,141,94,28.90,1825,216,25,1,'None',5,8,10.40,240,'wearable','2026-07-14 20:35:15'),(54,2,'2026-06-24',3898,4.80,'23:30:00','06:35:00',3,41.60,85,3,138,91,28.90,1821,180,18,0,'Light',3,8,9.90,240,'manual','2026-07-14 20:35:15'),(55,2,'2026-06-25',4321,4.50,'22:40:00','05:45:00',3,36.00,85,8,143,92,28.90,1812,237,23,1,'Light',4,8,10.40,240,'wearable','2026-07-14 20:35:15'),(56,2,'2026-06-26',4636,4.50,'23:00:00','06:15:00',3,35.00,87,12,141,93,28.90,1835,208,13,2,'Light',4,8,11.00,240,'manual','2026-07-14 20:35:15'),(57,2,'2026-06-27',4489,5.20,'22:50:00','05:55:00',3,42.40,84,11,139,94,28.90,1725,220,19,1,'Light',5,8,10.60,240,'wearable','2026-07-14 20:35:15'),(58,2,'2026-06-28',4386,4.40,'23:15:00','06:10:00',3,35.00,86,13,142,93,28.90,1802,252,22,1,'Light',5,7,10.80,240,'manual','2026-07-14 20:35:15'),(59,2,'2026-06-29',4981,4.70,'22:45:00','05:50:00',3,40.40,84,9,142,92,28.90,1825,256,25,1,'Light',5,7,10.30,240,'wearable','2026-07-14 20:35:15'),(60,2,'2026-06-30',4381,4.50,'23:05:00','06:05:00',3,40.00,85,5,142,95,28.90,1940,201,20,1,'Light',5,7,11.20,240,'manual','2026-07-14 20:35:15'),(61,3,'2026-06-01',6072,6.50,'23:05:00','06:05:00',1,80.00,74,33,127,80,25.50,2190,475,36,2,'Light',6,5,8.30,204,'wearable','2026-07-14 20:35:15'),(62,3,'2026-06-02',6885,6.30,'23:30:00','06:35:00',1,75.60,72,32,127,80,25.40,2169,508,41,2,'Light',6,5,7.40,176,'manual','2026-07-14 20:35:15'),(63,3,'2026-06-03',6363,6.30,'22:40:00','05:45:00',2,65.60,71,28,125,79,25.40,2199,437,34,2,'Light',6,6,7.30,185,'wearable','2026-07-14 20:35:15'),(64,3,'2026-06-04',6837,7.00,'23:00:00','06:15:00',0,88.00,71,31,126,79,25.40,2064,451,34,2,'Light',6,5,7.90,198,'manual','2026-07-14 20:35:15'),(65,3,'2026-06-05',6578,6.80,'22:50:00','05:55:00',1,77.60,72,32,128,79,25.40,2209,380,24,2,'Light',6,6,7.80,211,'wearable','2026-07-14 20:35:15'),(66,3,'2026-06-06',7301,6.70,'23:15:00','06:10:00',1,78.40,74,33,123,82,25.40,2115,458,30,3,'Light',6,6,8.40,215,'manual','2026-07-14 20:35:15'),(67,3,'2026-06-07',6598,6.40,'22:45:00','05:50:00',2,68.80,73,26,128,82,25.40,2134,428,34,2,'Light',5,6,7.50,189,'wearable','2026-07-14 20:35:15'),(68,3,'2026-06-08',6644,6.40,'23:05:00','06:05:00',2,70.80,72,23,127,82,25.40,2071,460,40,2,'Light',5,6,7.30,176,'manual','2026-07-14 20:35:15'),(69,3,'2026-06-09',7289,6.40,'23:30:00','06:35:00',2,68.80,73,28,129,81,25.40,2124,394,32,1,'Light',6,6,7.40,190,'wearable','2026-07-14 20:35:15'),(70,3,'2026-06-10',6863,6.70,'22:40:00','05:45:00',0,86.40,73,31,129,79,25.40,2095,436,32,2,'Light',6,5,7.80,199,'manual','2026-07-14 20:35:15'),(71,3,'2026-06-11',6910,7.10,'23:00:00','06:15:00',1,81.20,70,31,126,81,25.40,2051,428,31,2,'Light',6,6,7.90,202,'wearable','2026-07-14 20:35:15'),(72,3,'2026-06-12',7372,6.60,'22:50:00','05:55:00',1,75.20,72,34,126,80,25.40,2035,502,39,2,'Light',5,6,8.00,193,'manual','2026-07-14 20:35:15'),(73,3,'2026-06-13',6943,6.50,'23:15:00','06:10:00',1,76.00,73,33,126,78,25.40,2202,482,37,2,'Light',5,5,7.80,191,'wearable','2026-07-14 20:35:15'),(74,3,'2026-06-14',6743,6.50,'22:45:00','05:50:00',1,78.00,71,30,129,79,25.40,2109,476,38,2,'Light',6,4,7.00,172,'manual','2026-07-14 20:35:15'),(75,3,'2026-06-15',6987,7.00,'23:05:00','06:05:00',0,94.00,71,27,125,80,25.40,2039,360,28,1,'Light',6,5,7.60,200,'wearable','2026-07-14 20:35:15'),(76,3,'2026-06-16',6351,6.70,'23:30:00','06:35:00',0,88.40,72,36,128,81,25.40,2197,496,37,2,'Moderate',5,5,7.40,182,'manual','2026-07-14 20:35:15'),(77,3,'2026-06-17',6198,6.70,'22:40:00','05:45:00',0,86.40,71,33,128,80,25.40,2072,467,35,2,'Light',7,4,8.60,212,'wearable','2026-07-14 20:35:15'),(78,3,'2026-06-18',7211,6.50,'23:00:00','06:15:00',1,74.00,71,29,125,79,25.40,2207,494,41,2,'Light',5,5,7.00,168,'manual','2026-07-14 20:35:15'),(79,3,'2026-06-19',6887,6.50,'22:50:00','05:55:00',1,74.00,73,30,125,81,25.40,2112,484,39,2,'Light',6,4,7.20,175,'wearable','2026-07-14 20:35:15'),(80,3,'2026-06-20',6939,6.60,'23:15:00','06:10:00',0,85.20,72,24,126,81,25.40,2069,412,33,2,'Light',5,5,8.00,202,'manual','2026-07-14 20:35:15'),(81,3,'2026-06-21',6416,6.50,'22:45:00','05:50:00',1,78.00,71,27,126,80,25.40,2199,450,40,1,'Light',6,5,7.00,169,'wearable','2026-07-14 20:35:15'),(82,3,'2026-06-22',6034,6.30,'23:05:00','06:05:00',1,77.60,72,33,126,79,25.40,2212,452,33,2,'Light',6,5,7.60,193,'manual','2026-07-14 20:35:15'),(83,3,'2026-06-23',7399,6.80,'23:30:00','06:35:00',0,89.60,71,31,124,79,25.40,2132,460,39,1,'Light',7,5,7.30,177,'wearable','2026-07-14 20:35:15'),(84,3,'2026-06-24',6749,6.20,'22:40:00','05:45:00',2,64.40,72,26,127,79,25.40,2049,378,31,1,'Light',6,6,7.00,183,'manual','2026-07-14 20:35:15'),(85,3,'2026-06-25',6896,6.60,'23:00:00','06:15:00',1,75.20,73,30,127,80,25.40,2169,476,38,2,'Light',5,6,7.50,183,'wearable','2026-07-14 20:35:15'),(86,3,'2026-06-26',6227,6.60,'22:50:00','05:55:00',0,83.20,71,33,125,80,25.40,2154,445,32,2,'Light',7,5,7.70,196,'manual','2026-07-14 20:35:15'),(87,3,'2026-06-27',7112,6.30,'23:15:00','06:10:00',1,73.60,74,27,129,79,25.40,2072,433,34,2,'Light',6,5,7.60,191,'wearable','2026-07-14 20:35:15'),(88,3,'2026-06-28',6441,6.30,'22:45:00','05:50:00',2,67.60,72,24,128,82,25.40,2124,485,39,3,'Light',6,6,7.50,182,'manual','2026-07-14 20:35:15'),(89,3,'2026-06-29',6765,6.60,'23:05:00','06:05:00',0,89.20,71,27,125,80,25.40,2155,412,35,1,'Light',7,5,7.30,183,'wearable','2026-07-14 20:35:15'),(90,3,'2026-06-30',6725,6.60,'23:30:00','06:35:00',0,87.20,71,33,128,81,25.40,2005,392,25,2,'Light',5,5,7.30,198,'manual','2026-07-14 20:35:15'),(91,4,'2026-06-01',9188,7.60,'23:30:00','06:35:00',0,96.80,67,59,122,79,24.20,2441,828,60,4,'Vigorous',7,4,5.70,125,'wearable','2026-07-14 20:35:15'),(92,4,'2026-06-02',9039,7.40,'22:40:00','05:45:00',0,94.80,67,71,122,76,24.20,2365,859,57,4,'Vigorous',8,4,5.60,123,'manual','2026-07-14 20:35:15'),(93,4,'2026-06-03',9209,7.50,'23:00:00','06:15:00',0,94.00,68,62,120,78,24.20,2486,894,67,4,'Vigorous',8,3,5.00,110,'wearable','2026-07-14 20:35:15'),(94,4,'2026-06-04',9240,6.50,'22:50:00','05:55:00',1,74.00,67,59,119,78,24.20,2382,805,57,4,'Vigorous',8,4,5.10,112,'manual','2026-07-14 20:35:15'),(95,4,'2026-06-05',9165,7.30,'23:15:00','06:10:00',0,93.60,68,57,120,78,24.20,2403,716,50,3,'Moderate',8,3,5.90,130,'wearable','2026-07-14 20:35:15'),(96,4,'2026-06-06',9601,7.20,'22:45:00','05:50:00',0,94.40,68,70,122,79,24.20,2466,965,68,5,'Vigorous',8,5,5.30,117,'manual','2026-07-14 20:35:15'),(97,4,'2026-06-07',9538,7.20,'23:05:00','06:05:00',0,96.40,66,65,120,78,24.20,2438,847,59,4,'Vigorous',8,3,4.90,108,'wearable','2026-07-14 20:35:15'),(98,4,'2026-06-08',8867,6.70,'23:30:00','06:35:00',0,88.40,69,64,119,77,24.20,2337,813,55,4,'Vigorous',8,4,6.00,132,'manual','2026-07-14 20:35:15'),(99,4,'2026-06-09',8975,7.00,'22:40:00','05:45:00',0,90.00,71,67,120,79,24.20,2403,899,61,5,'Vigorous',8,4,6.60,145,'wearable','2026-07-14 20:35:15'),(100,4,'2026-06-10',9266,7.50,'23:00:00','06:15:00',0,94.00,68,66,122,78,24.20,2438,824,59,3,'Vigorous',8,4,5.80,128,'manual','2026-07-14 20:35:15'),(101,4,'2026-06-11',8886,6.70,'22:50:00','05:55:00',0,84.40,70,65,120,79,24.20,2423,945,72,4,'Vigorous',7,4,6.00,132,'wearable','2026-07-14 20:35:15'),(102,4,'2026-06-12',8698,6.60,'23:15:00','06:10:00',0,85.20,70,68,120,76,24.20,2451,936,69,4,'Vigorous',8,4,5.30,117,'manual','2026-07-14 20:35:15'),(103,4,'2026-06-13',9015,7.20,'22:45:00','05:50:00',0,94.40,68,56,121,79,24.20,2412,844,64,4,'Vigorous',7,4,5.30,117,'wearable','2026-07-14 20:35:15'),(104,4,'2026-06-14',9025,7.00,'23:05:00','06:05:00',0,94.00,70,65,121,79,24.20,2406,817,55,4,'Vigorous',9,5,5.70,125,'manual','2026-07-14 20:35:15'),(105,4,'2026-06-15',9558,7.40,'23:30:00','06:35:00',0,96.80,67,63,119,78,24.20,2460,883,65,4,'Vigorous',8,5,5.20,114,'wearable','2026-07-14 20:35:15'),(106,4,'2026-06-16',8664,7.00,'22:40:00','05:45:00',0,90.00,68,63,119,79,24.20,2296,928,71,4,'Vigorous',9,3,5.40,119,'manual','2026-07-14 20:35:15'),(107,4,'2026-06-17',8352,6.40,'23:00:00','06:15:00',1,72.80,70,59,118,78,24.20,2427,843,62,4,'Vigorous',8,4,6.20,136,'wearable','2026-07-14 20:35:15'),(108,4,'2026-06-18',9470,7.20,'22:50:00','05:55:00',0,90.40,67,59,122,79,24.20,2448,820,59,4,'Vigorous',7,4,5.30,117,'manual','2026-07-14 20:35:15'),(109,4,'2026-06-19',8226,6.90,'23:15:00','06:10:00',0,88.80,68,67,121,80,24.20,2376,813,57,3,'Vigorous',8,4,5.40,119,'wearable','2026-07-14 20:35:15'),(110,4,'2026-06-20',8353,7.10,'22:45:00','05:50:00',0,93.20,67,69,120,77,24.20,2431,895,63,4,'Vigorous',7,4,5.90,130,'manual','2026-07-14 20:35:15'),(111,4,'2026-06-21',8255,7.60,'23:05:00','06:05:00',0,98.80,68,70,121,79,24.20,2396,842,59,3,'Vigorous',9,5,6.20,136,'wearable','2026-07-14 20:35:15'),(112,4,'2026-06-22',8567,7.20,'23:30:00','06:35:00',0,94.40,68,63,120,79,24.20,2402,838,59,4,'Vigorous',8,5,4.90,108,'manual','2026-07-14 20:35:15'),(113,4,'2026-06-23',8978,7.30,'22:40:00','05:45:00',0,93.60,69,66,122,78,24.20,2347,904,66,4,'Vigorous',8,4,6.00,132,'wearable','2026-07-14 20:35:15'),(114,4,'2026-06-24',8840,7.00,'23:00:00','06:15:00',0,88.00,69,70,120,79,24.20,2293,855,57,4,'Vigorous',7,4,6.00,132,'manual','2026-07-14 20:35:15'),(115,4,'2026-06-25',8894,7.20,'22:50:00','05:55:00',0,90.40,66,66,119,80,24.20,2356,904,66,4,'Vigorous',9,4,5.20,114,'wearable','2026-07-14 20:35:15'),(116,4,'2026-06-26',8775,7.70,'23:15:00','06:10:00',0,93.60,67,70,119,77,24.20,2442,902,67,3,'Vigorous',8,4,6.40,141,'manual','2026-07-14 20:35:15'),(117,4,'2026-06-27',8559,7.20,'22:45:00','05:50:00',0,94.40,70,72,121,78,24.20,2373,944,64,5,'Vigorous',8,4,6.30,139,'wearable','2026-07-14 20:35:15'),(118,4,'2026-06-28',8566,7.30,'23:05:00','06:05:00',0,97.60,68,74,120,79,24.20,2515,925,64,4,'Vigorous',8,3,5.70,125,'manual','2026-07-14 20:35:15'),(119,4,'2026-06-29',9461,7.40,'23:30:00','06:35:00',0,96.80,68,68,119,77,24.20,2404,846,57,4,'Vigorous',8,4,5.20,114,'wearable','2026-07-14 20:35:15'),(120,4,'2026-06-30',8943,7.30,'22:40:00','05:45:00',0,93.60,68,73,118,78,24.20,2431,936,66,4,'Vigorous',8,4,5.50,121,'manual','2026-07-14 20:35:15'),(121,5,'2026-06-01',7125,6.90,'22:40:00','05:45:00',0,88.80,71,44,119,78,24.80,2221,687,54,3,'Moderate',7,4,5.60,123,'wearable','2026-07-14 20:35:15'),(122,5,'2026-06-02',7956,7.10,'23:00:00','06:15:00',0,89.20,69,48,124,79,24.80,2214,655,51,2,'Moderate',7,4,6.10,134,'manual','2026-07-14 20:35:15'),(123,5,'2026-06-03',8607,6.40,'22:50:00','05:55:00',1,72.80,69,38,122,80,24.80,2307,613,44,4,'Moderate',7,4,5.30,126,'wearable','2026-07-14 20:35:15'),(124,5,'2026-06-04',8468,6.90,'23:15:00','06:10:00',0,88.80,71,56,124,80,24.80,2239,638,44,2,'Moderate',7,5,6.50,152,'manual','2026-07-14 20:35:15'),(125,5,'2026-06-05',8015,7.10,'22:45:00','05:50:00',0,93.20,71,38,120,79,24.80,2197,540,38,3,'Moderate',7,5,5.90,148,'wearable','2026-07-14 20:35:15'),(126,5,'2026-06-06',7984,7.20,'23:05:00','06:05:00',0,96.40,69,45,122,78,24.80,2212,641,51,2,'Moderate',8,4,5.30,117,'manual','2026-07-14 20:35:15'),(127,5,'2026-06-07',7527,6.90,'23:30:00','06:35:00',0,90.80,70,35,121,80,24.80,2271,564,43,3,'Moderate',7,5,6.30,149,'wearable','2026-07-14 20:35:15'),(128,5,'2026-06-08',7397,7.10,'22:40:00','05:45:00',0,91.20,71,49,120,80,24.80,2339,605,40,3,'Moderate',7,4,6.30,154,'manual','2026-07-14 20:35:15'),(129,5,'2026-06-09',8528,7.20,'23:00:00','06:15:00',0,90.40,71,49,122,79,24.80,2252,725,56,3,'Moderate',6,4,5.10,112,'wearable','2026-07-14 20:35:15'),(130,5,'2026-06-10',7729,7.00,'22:50:00','05:55:00',0,88.00,69,50,121,78,24.80,2316,574,39,2,'Moderate',7,5,5.80,144,'manual','2026-07-14 20:35:15'),(131,5,'2026-06-11',7393,6.90,'23:15:00','06:10:00',0,88.80,69,34,122,79,24.80,2284,560,43,3,'Light',7,4,5.20,125,'wearable','2026-07-14 20:35:15'),(132,5,'2026-06-12',7396,6.80,'22:45:00','05:50:00',0,89.60,69,43,123,81,24.80,2150,681,50,4,'Moderate',7,5,5.80,128,'manual','2026-07-14 20:35:15'),(133,5,'2026-06-13',7761,7.10,'23:05:00','06:05:00',0,95.20,71,45,119,78,24.80,2265,592,37,4,'Moderate',7,4,6.30,158,'wearable','2026-07-14 20:35:15'),(134,5,'2026-06-14',7355,7.30,'23:30:00','06:35:00',0,95.60,68,48,124,79,24.70,2323,653,47,3,'Moderate',7,4,6.30,143,'manual','2026-07-14 20:35:15'),(135,5,'2026-06-15',7486,6.40,'22:40:00','05:45:00',1,74.80,71,39,123,80,24.80,2364,584,47,2,'Moderate',7,5,6.00,137,'wearable','2026-07-14 20:35:15'),(136,5,'2026-06-16',7249,6.90,'23:00:00','06:15:00',0,86.80,70,51,120,80,24.80,2302,674,48,3,'Moderate',7,5,5.80,131,'manual','2026-07-14 20:35:15'),(137,5,'2026-06-17',8193,7.30,'22:50:00','05:55:00',0,91.60,71,49,121,79,24.80,2184,678,46,4,'Moderate',7,4,6.80,156,'wearable','2026-07-14 20:35:15'),(138,5,'2026-06-18',7492,6.60,'23:15:00','06:10:00',0,85.20,70,44,121,77,24.80,2291,612,44,3,'Moderate',7,5,6.50,152,'manual','2026-07-14 20:35:15'),(139,5,'2026-06-19',7515,6.70,'22:45:00','05:50:00',0,88.40,71,42,122,79,24.80,2299,613,49,2,'Moderate',6,3,6.10,136,'wearable','2026-07-14 20:35:15'),(140,5,'2026-06-20',8804,6.40,'23:05:00','06:05:00',1,78.80,70,39,124,78,24.80,2303,627,49,3,'Moderate',6,3,4.80,107,'manual','2026-07-14 20:35:15'),(141,5,'2026-06-21',7512,7.30,'23:30:00','06:35:00',0,95.60,70,49,123,81,24.80,2280,710,54,3,'Moderate',7,4,6.10,134,'wearable','2026-07-14 20:35:15'),(142,5,'2026-06-22',8127,7.00,'22:40:00','05:45:00',0,90.00,68,49,122,80,24.80,2340,582,37,3,'Moderate',6,4,5.00,130,'manual','2026-07-14 20:35:15'),(143,5,'2026-06-23',7576,7.00,'23:00:00','06:15:00',0,88.00,70,42,123,78,24.80,2225,678,54,3,'Moderate',7,4,6.20,136,'wearable','2026-07-14 20:35:15'),(144,5,'2026-06-24',8025,6.80,'22:50:00','05:55:00',0,85.60,70,40,120,80,24.80,2219,645,47,4,'Moderate',8,4,6.30,143,'manual','2026-07-14 20:35:15'),(145,5,'2026-06-25',6925,7.30,'23:15:00','06:10:00',0,93.60,71,44,119,81,24.80,2164,657,50,3,'Moderate',7,4,7.30,161,'wearable','2026-07-14 20:35:15'),(146,5,'2026-06-26',7998,6.60,'22:45:00','05:50:00',0,87.20,70,36,122,79,24.80,2202,659,55,3,'Moderate',7,3,5.80,128,'manual','2026-07-14 20:35:15'),(147,5,'2026-06-27',7202,6.70,'23:05:00','06:05:00',0,90.40,72,40,121,79,24.80,2220,677,55,3,'Moderate',7,3,7.00,154,'wearable','2026-07-14 20:35:15'),(148,5,'2026-06-28',8372,7.30,'23:30:00','06:35:00',0,95.60,69,43,122,79,24.80,2193,690,55,3,'Moderate',8,5,5.20,114,'manual','2026-07-14 20:35:15'),(149,5,'2026-06-29',8294,6.70,'22:40:00','05:45:00',0,86.40,69,44,124,79,24.80,2223,650,49,3,'Moderate',7,3,4.90,109,'wearable','2026-07-14 20:35:15'),(150,5,'2026-06-30',8230,7.20,'23:00:00','06:15:00',0,90.40,71,47,121,78,24.80,2198,628,48,2,'Moderate',8,4,5.80,131,'manual','2026-07-14 20:35:15');
/*!40000 ALTER TABLE `patient_daily_health_fact` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_intake_assessment`
--

DROP TABLE IF EXISTS `patient_intake_assessment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_intake_assessment` (
  `intake_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `intake_date` date NOT NULL,
  `systolic_bp` int DEFAULT NULL,
  `diastolic_bp` int DEFAULT NULL,
  `bmi` decimal(5,2) DEFAULT NULL,
  `resting_hr` int DEFAULT NULL,
  `daily_steps` int DEFAULT NULL,
  `active_minutes` int DEFAULT NULL,
  `sleep_hours` decimal(4,2) DEFAULT NULL,
  `workouts_per_week` int DEFAULT NULL,
  `exercise_days_per_week` int DEFAULT NULL,
  `diet_score` int DEFAULT NULL,
  `stress_level` int DEFAULT NULL,
  `sedentary_hours` decimal(4,2) DEFAULT NULL,
  `clinical_note` text,
  `medication_note` text,
  `created_by_clinician` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`intake_id`),
  KEY `patient_id` (`patient_id`),
  KEY `created_by_clinician` (`created_by_clinician`),
  CONSTRAINT `patient_intake_assessment_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`),
  CONSTRAINT `patient_intake_assessment_ibfk_2` FOREIGN KEY (`created_by_clinician`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_intake_assessment`
--

LOCK TABLES `patient_intake_assessment` WRITE;
/*!40000 ALTER TABLE `patient_intake_assessment` DISABLE KEYS */;
/*!40000 ALTER TABLE `patient_intake_assessment` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_kpi_values`
--

DROP TABLE IF EXISTS `patient_kpi_values`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_kpi_values` (
  `kpi_value_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `kpi_type_id` int NOT NULL,
  `calculation_date` date NOT NULL,
  `numeric_value` decimal(10,2) DEFAULT NULL,
  `text_value` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`kpi_value_id`),
  KEY `patient_id` (`patient_id`),
  KEY `kpi_type_id` (`kpi_type_id`),
  CONSTRAINT `patient_kpi_values_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`),
  CONSTRAINT `patient_kpi_values_ibfk_2` FOREIGN KEY (`kpi_type_id`) REFERENCES `kpi_types` (`kpi_type_id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_kpi_values`
--

LOCK TABLES `patient_kpi_values` WRITE;
/*!40000 ALTER TABLE `patient_kpi_values` DISABLE KEYS */;
INSERT INTO `patient_kpi_values` VALUES (1,1,1,'2026-06-24',58.00,'Moderate'),(2,1,2,'2026-06-24',47.00,'Moderate'),(3,1,3,'2026-06-24',62.00,'Moderate'),(4,1,4,'2026-06-24',58.00,'Moderate'),(5,1,1,'2026-06-30',64.00,'Moderate'),(6,1,2,'2026-06-30',50.00,'Moderate'),(7,1,3,'2026-06-30',66.00,'Moderate'),(8,1,4,'2026-06-30',62.00,'Moderate'),(9,2,1,'2026-06-24',68.00,'Moderate'),(10,2,2,'2026-06-24',49.00,'Moderate'),(11,2,3,'2026-06-24',71.00,'Moderate'),(12,2,4,'2026-06-24',66.00,'Moderate'),(13,2,1,'2026-06-30',74.00,'Moderate'),(14,2,2,'2026-06-30',52.00,'Moderate'),(15,2,3,'2026-06-30',75.00,'Moderate'),(16,2,4,'2026-06-30',71.00,'Good'),(17,3,1,'2026-06-24',78.00,'Good'),(18,3,2,'2026-06-24',50.00,'Moderate'),(19,3,3,'2026-06-24',80.00,'Consistent'),(20,3,4,'2026-06-24',75.00,'Good'),(21,3,1,'2026-06-30',84.00,'Good'),(22,3,2,'2026-06-30',53.00,'Moderate'),(23,3,3,'2026-06-30',66.00,'Moderate'),(24,3,4,'2026-06-30',59.00,'Moderate'),(25,4,1,'2026-06-24',88.00,'Good'),(26,4,2,'2026-06-24',52.00,'Moderate'),(27,4,3,'2026-06-24',72.00,'Moderate'),(28,4,4,'2026-06-24',63.00,'Moderate'),(29,4,1,'2026-06-30',94.00,'Good'),(30,4,2,'2026-06-30',40.00,'Low'),(31,4,3,'2026-06-30',75.00,'Consistent'),(32,4,4,'2026-06-30',67.00,'Moderate'),(33,5,1,'2026-06-24',98.00,'Good'),(34,5,2,'2026-06-24',38.00,'Low'),(35,5,3,'2026-06-24',56.00,'Moderate'),(36,5,4,'2026-06-24',72.00,'Good'),(37,5,1,'2026-06-30',74.00,'Moderate'),(38,5,2,'2026-06-30',41.00,'Moderate'),(39,5,3,'2026-06-30',59.00,'Moderate'),(40,5,4,'2026-06-30',76.00,'Good');
/*!40000 ALTER TABLE `patient_kpi_values` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_metric_preferences`
--

DROP TABLE IF EXISTS `patient_metric_preferences`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_metric_preferences` (
  `patient_id` int NOT NULL,
  `step_goal` int DEFAULT NULL,
  `sleep_goal_hours` decimal(3,1) DEFAULT NULL,
  `exercise_goal_minutes` int DEFAULT NULL,
  `active_minute_goal` int DEFAULT NULL,
  `sedentary_limit_hours` decimal(3,1) DEFAULT NULL,
  `active_calorie_goal` int DEFAULT NULL,
  `resting_hr_baseline_low` int DEFAULT NULL,
  `resting_hr_baseline_high` int DEFAULT NULL,
  `bp_systolic_target_max` int DEFAULT NULL,
  `bp_diastolic_target_max` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`patient_id`),
  CONSTRAINT `fk_patient_metric_preferences_patient` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_metric_preferences`
--

LOCK TABLES `patient_metric_preferences` WRITE;
/*!40000 ALTER TABLE `patient_metric_preferences` DISABLE KEYS */;
INSERT INTO `patient_metric_preferences` VALUES (1,10000,8.0,60,60,8.0,800,60,72,120,80,'2026-07-14 20:35:14','2026-07-14 20:35:14'),(2,9000,8.0,45,55,8.0,700,66,73,120,80,'2026-07-14 20:35:14','2026-07-14 20:35:14'),(3,8500,7.5,50,60,7.5,760,70,78,125,82,'2026-07-14 20:35:14','2026-07-14 20:35:14'),(4,10000,7.5,70,65,8.0,850,64,72,120,80,'2026-07-14 20:35:14','2026-07-14 20:35:14'),(5,9000,8.0,50,55,7.5,720,67,75,122,80,'2026-07-14 20:35:14','2026-07-14 20:35:14');
/*!40000 ALTER TABLE `patient_metric_preferences` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_profiles`
--

DROP TABLE IF EXISTS `patient_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_profiles` (
  `patient_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `medical_record_number_hash` char(64) DEFAULT NULL,
  `consent_status` tinyint(1) NOT NULL DEFAULT '0',
  `primary_focus` varchar(150) DEFAULT NULL,
  PRIMARY KEY (`patient_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `patient_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_profiles`
--

LOCK TABLES `patient_profiles` WRITE;
/*!40000 ALTER TABLE `patient_profiles` DISABLE KEYS */;
INSERT INTO `patient_profiles` VALUES (1,1,NULL,1,'Maintain routine'),(2,2,NULL,1,'Sleep consistency'),(3,3,NULL,1,'Activity drop'),(4,4,NULL,1,'Exercise progress'),(5,5,NULL,1,'Recovery balance');
/*!40000 ALTER TABLE `patient_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recommendations`
--

DROP TABLE IF EXISTS `recommendations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recommendations` (
  `recommendation_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `created_by_user_id` int DEFAULT NULL,
  `recommendation_text` text NOT NULL,
  `status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`recommendation_id`),
  KEY `patient_id` (`patient_id`),
  KEY `created_by_user_id` (`created_by_user_id`),
  CONSTRAINT `recommendations_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`),
  CONSTRAINT `recommendations_ibfk_2` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recommendations`
--

LOCK TABLES `recommendations` WRITE;
/*!40000 ALTER TABLE `recommendations` DISABLE KEYS */;
INSERT INTO `recommendations` VALUES (1,1,7,'Try a 10-minute walk after meals.','not_started','2026-07-14 20:35:15'),(2,1,7,'Keep bedtime within the same 30-minute window.','in_progress','2026-07-14 20:35:15'),(3,1,7,'Add one light stretching session after workouts.','completed','2026-07-14 20:35:15'),(4,1,7,'Drink water before afternoon activity.','not_started','2026-07-14 20:35:15'),(5,2,7,'Try a 10-minute walk after meals.','not_started','2026-07-14 20:35:15'),(6,2,7,'Keep bedtime within the same 30-minute window.','in_progress','2026-07-14 20:35:15'),(7,2,7,'Add one light stretching session after workouts.','completed','2026-07-14 20:35:15'),(8,2,7,'Drink water before afternoon activity.','not_started','2026-07-14 20:35:15'),(9,3,7,'Try a 10-minute walk after meals.','not_started','2026-07-14 20:35:15'),(10,3,7,'Keep bedtime within the same 30-minute window.','in_progress','2026-07-14 20:35:15'),(11,3,7,'Add one light stretching session after workouts.','completed','2026-07-14 20:35:15'),(12,3,7,'Drink water before afternoon activity.','not_started','2026-07-14 20:35:15'),(13,4,7,'Try a 10-minute walk after meals.','not_started','2026-07-14 20:35:15'),(14,4,7,'Keep bedtime within the same 30-minute window.','in_progress','2026-07-14 20:35:15'),(15,4,7,'Add one light stretching session after workouts.','completed','2026-07-14 20:35:15'),(16,4,7,'Drink water before afternoon activity.','not_started','2026-07-14 20:35:15'),(17,5,7,'Try a 10-minute walk after meals.','not_started','2026-07-14 20:35:15'),(18,5,7,'Keep bedtime within the same 30-minute window.','in_progress','2026-07-14 20:35:15'),(19,5,7,'Add one light stretching session after workouts.','completed','2026-07-14 20:35:15'),(20,5,7,'Drink water before afternoon activity.','not_started','2026-07-14 20:35:15');
/*!40000 ALTER TABLE `recommendations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(30) NOT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (3,'clinician'),(4,'dba'),(1,'patient'),(2,'trainer');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trainer_notes`
--

DROP TABLE IF EXISTS `trainer_notes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `trainer_notes` (
  `note_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `trainer_user_id` int NOT NULL,
  `note_text` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`note_id`),
  KEY `patient_id` (`patient_id`),
  KEY `trainer_user_id` (`trainer_user_id`),
  CONSTRAINT `trainer_notes_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patient_profiles` (`patient_id`),
  CONSTRAINT `trainer_notes_ibfk_2` FOREIGN KEY (`trainer_user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trainer_notes`
--

LOCK TABLES `trainer_notes` WRITE;
/*!40000 ALTER TABLE `trainer_notes` DISABLE KEYS */;
INSERT INTO `trainer_notes` VALUES (1,1,6,'You are building a great routine. Consistency is the key this week.','2026-07-14 20:35:15'),(2,2,6,'Great job staying active! Keep up the momentum.','2026-07-14 20:35:15'),(3,3,6,'Focus on recovery this week - sleep and hydration matter.','2026-07-14 20:35:15'),(4,4,6,'Excellent progress on your goals! Let\'s keep it going.','2026-07-14 20:35:15'),(5,5,6,'Remember to listen to your body and rest when needed.','2026-07-14 20:35:15');
/*!40000 ALTER TABLE `trainer_notes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_pii`
--

DROP TABLE IF EXISTS `user_pii`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_pii` (
  `user_id` int NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `age` int DEFAULT NULL,
  `height_inches` decimal(4,1) DEFAULT NULL,
  `weight_lbs` decimal(5,1) DEFAULT NULL,
  `gender` varchar(30) DEFAULT NULL,
  `email` varchar(120) NOT NULL,
  `encrypted_phone` varbinary(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `encrypted_health_card_no` varbinary(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  CONSTRAINT `user_pii_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_pii`
--

LOCK TABLES `user_pii` WRITE;
/*!40000 ALTER TABLE `user_pii` DISABLE KEYS */;
INSERT INTO `user_pii` VALUES (1,'Alex Johnson','2002-04-12','2002-04-12',24,70.0,165.0,'Male','alex@example.com',NULL,'2026-07-14 20:35:14',NULL),(2,'Maria Garcia','1998-08-25','1998-08-25',27,64.0,168.0,'Female','maria@example.com',NULL,'2026-07-14 20:35:14',NULL),(3,'James Kim','1995-11-03','1995-11-03',30,69.0,172.0,'Male','james@example.com',NULL,'2026-07-14 20:35:14',NULL),(4,'Sophie Patel','2000-06-18','2000-06-18',26,65.0,150.0,'Female','sophie@example.com',NULL,'2026-07-14 20:35:14',NULL),(5,'Daniel Lee','1997-09-30','1997-09-30',28,70.0,173.0,'Male','daniel@example.com',NULL,'2026-07-14 20:35:14',NULL),(6,'Jordan Lee','1990-03-15','1990-03-15',36,68.0,170.0,'Non-binary','jordan@example.com',NULL,'2026-07-14 20:35:14',NULL),(7,'Dr. Rivera','1985-07-22','1985-07-22',40,66.0,145.0,'Female','rivera@example.com',NULL,'2026-07-14 20:35:14',NULL);
/*!40000 ALTER TABLE `user_pii` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `account_status` enum('active','inactive','locked') NOT NULL DEFAULT 'active',
  `password_hash` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  KEY `role_id` (`role_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(2,1,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(3,1,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(4,1,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(5,1,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(6,2,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14'),(7,3,'active','$2b$10$E2yeIfbsD0E5ByP2J0mF4.41PIWBvID3PgLuyEGkwwrD09mFTY1yO','2026-07-14 20:35:14');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_patient_masked_identity`
--

DROP TABLE IF EXISTS `v_patient_masked_identity`;
/*!50001 DROP VIEW IF EXISTS `v_patient_masked_identity`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_patient_masked_identity` AS SELECT 
 1 AS `patient_id`,
 1 AS `masked_name`,
 1 AS `masked_email`,
 1 AS `age_range`,
 1 AS `gender`,
 1 AS `consent_status`,
 1 AS `primary_focus`*/;
SET character_set_client = @saved_cs_client;

--
-- Current Database: `wellpath_health`
--

USE `wellpath_health`;

--
-- Final view structure for view `v_patient_masked_identity`
--

/*!50001 DROP VIEW IF EXISTS `v_patient_masked_identity`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_patient_masked_identity` AS select `pp`.`patient_id` AS `patient_id`,concat(left(`up`.`full_name`,1),'***') AS `masked_name`,concat(left(`up`.`email`,2),'***@',substring_index(`up`.`email`,'@',-(1))) AS `masked_email`,(case when (timestampdiff(YEAR,`up`.`date_of_birth`,curdate()) < 20) then 'Under 20' when (timestampdiff(YEAR,`up`.`date_of_birth`,curdate()) between 20 and 29) then '20-29' when (timestampdiff(YEAR,`up`.`date_of_birth`,curdate()) between 30 and 39) then '30-39' when (timestampdiff(YEAR,`up`.`date_of_birth`,curdate()) between 40 and 49) then '40-49' when (timestampdiff(YEAR,`up`.`date_of_birth`,curdate()) between 50 and 59) then '50-59' else '60+' end) AS `age_range`,`up`.`gender` AS `gender`,`pp`.`consent_status` AS `consent_status`,`pp`.`primary_focus` AS `primary_focus` from (`patient_profiles` `pp` join `user_pii` `up` on((`pp`.`user_id` = `up`.`user_id`))) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-14 17:40:44
