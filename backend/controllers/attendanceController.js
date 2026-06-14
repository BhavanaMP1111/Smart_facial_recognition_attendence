const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const UnknownDetection = require('../models/UnknownDetection');

/**
 * @desc    Mark attendance for a student (facial scan checking)
 * @route   POST /api/attendance/mark
 * @access  Private
 */
const markAttendance = async (req, res) => {
  try {
    const { studentId, confidence, markedBy } = req.body;
    
    // Default date to today's date in YYYY-MM-DD format (local server time)
    const todayStr = new Date().toISOString().split('T')[0];

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    // Verify student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if attendance already marked today
    const existingAttendance = await Attendance.findOne({
      student: studentId,
      date: todayStr,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        alreadyMarked: true,
        message: `Attendance already marked today for ${student.name} (${student.usn})`,
        data: existingAttendance,
      });
    }

    // Record attendance
    const attendance = await Attendance.create({
      student: studentId,
      date: todayStr,
      status: 'Present',
      markedBy: markedBy || 'webcam',
      confidence: confidence || 100,
    });

    // Populate student details
    const populatedAttendance = await attendance.populate('student', 'name usn department semester');

    res.status(201).json({
      success: true,
      message: `Attendance marked successfully for ${student.name}`,
      data: populatedAttendance,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get attendance logs with filters
 * @route   GET /api/attendance/logs
 * @access  Private
 */
const getAttendanceLogs = async (req, res) => {
  try {
    const { date, department, semester, search, status } = req.query;
    
    let studentMatch = {};
    if (department) studentMatch.department = department;
    if (semester) studentMatch.semester = semester;
    if (search) {
      studentMatch.$or = [
        { name: { $regex: search, $options: 'i' } },
        { usn: { $regex: search, $options: 'i' } }
      ];
    }

    // Special logic for ABSENT status filter
    if (status === 'Absent') {
      const queryDate = date || new Date().toISOString().split('T')[0];

      // 1. Find all students matching query filters
      const allStudents = await Student.find(studentMatch).select('name usn department semester');

      // 2. Find student ObjectIds that are Present or Late on this date
      const presentLogs = await Attendance.find({
        date: queryDate,
        status: { $in: ['Present', 'Late'] }
      }).select('student');

      const presentStudentIds = presentLogs.map(log => log.student.toString());

      // 3. Subtract present students from all students
      const absentStudents = allStudents.filter(s => !presentStudentIds.includes(s._id.toString()));

      // 4. Map them to look like attendance logs
      const absentLogs = absentStudents.map(student => ({
        _id: `absent_${student._id}_${queryDate}`,
        student,
        date: queryDate,
        timestamp: new Date(`${queryDate}T00:00:00Z`),
        status: 'Absent',
        markedBy: 'none',
        confidence: 0
      }));

      return res.json({
        success: true,
        count: absentLogs.length,
        data: absentLogs,
      });
    }

    let attendanceQuery = {};
    if (date) attendanceQuery.date = date;
    if (status) attendanceQuery.status = status;

    // Fetch attendance and filter based on populated Student fields
    let logs = await Attendance.find(attendanceQuery)
      .populate({
        path: 'student',
        match: studentMatch,
        select: 'name usn department semester',
      })
      .sort({ timestamp: -1 });

    // Filter out records where student match failed (because of studentMatch filters)
    logs = logs.filter((log) => log.student !== null);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Manual override/correction of attendance
 * @route   POST /api/attendance/manual
 * @access  Private
 */
const manualCorrection = async (req, res) => {
  try {
    const { studentId, date, status, markedBy } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide studentId, date (YYYY-MM-DD), and status',
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check if attendance already exists for this day
    let attendance = await Attendance.findOne({ student: studentId, date });

    if (attendance) {
      // Update existing record
      attendance.status = status;
      attendance.markedBy = markedBy || 'manual';
      attendance.confidence = 100; // 100% confidence for manual override
      await attendance.save();
    } else {
      // Create new record
      attendance = await Attendance.create({
        student: studentId,
        date,
        status,
        markedBy: markedBy || 'manual',
        confidence: 100,
      });
    }

    const populated = await attendance.populate('student', 'name usn department semester');

    res.json({
      success: true,
      message: `Manual correction updated: ${student.name} marked ${status} on ${date}`,
      data: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Fetch statistical telemetry for Dashboard
 * @route   GET /api/attendance/dashboard/stats
 * @access  Private
 */
const getDashboardStats = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Total Registered Students
    const totalStudents = await Student.countDocuments();

    // 2. Today's Attendance Logs
    const todayLogs = await Attendance.find({ date: todayStr }).populate('student', 'department');
    const presentCount = todayLogs.filter(log => log.status === 'Present').length;
    const lateCount = todayLogs.filter(log => log.status === 'Late').length;
    const todayPresentCount = presentCount + lateCount;
    
    const todayAbsentCount = Math.max(0, totalStudents - todayPresentCount);

    // 3. Security alerts / Unknown faces today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayUnknownCount = await UnknownDetection.countDocuments({
      timestamp: { $gte: startOfToday },
      status: 'unresolved'
    });

    // 4. Attendance Percentage Today
    const todayAttendanceRate = totalStudents > 0 
      ? Math.round((todayPresentCount / totalStudents) * 100) 
      : 0;

    // 5. Department wise distribution today
    // Initialize standard departments
    const deptStatsMap = {};
    const studentsList = await Student.find({}).select('department');
    studentsList.forEach(s => {
      if (!deptStatsMap[s.department]) {
        deptStatsMap[s.department] = { total: 0, present: 0 };
      }
      deptStatsMap[s.department].total += 1;
    });

    todayLogs.forEach(log => {
      if (log.student && log.student.department && (log.status === 'Present' || log.status === 'Late')) {
        const dept = log.student.department;
        if (deptStatsMap[dept]) {
          deptStatsMap[dept].present += 1;
        }
      }
    });

    const departmentStats = Object.keys(deptStatsMap).map(key => {
      const total = deptStatsMap[key].total;
      const present = deptStatsMap[key].present;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        department: key,
        total,
        present,
        absent: total - present,
        rate
      };
    });

    // 6. Last 7 Days Attendance Trend (for Charts)
    const trendDays = 7;
    const attendanceTrend = [];
    
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayLogs = await Attendance.find({ date: dateStr, status: { $in: ['Present', 'Late'] } });
      const dayPresent = dayLogs.length;
      const dayAbsent = Math.max(0, totalStudents - dayPresent);
      
      // Get weekday name
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      attendanceTrend.push({
        date: dateStr,
        dayName,
        present: dayPresent,
        absent: dayAbsent,
        rate: totalStudents > 0 ? Math.round((dayPresent / totalStudents) * 100) : 0
      });
    }

    res.json({
      success: true,
      data: {
        metrics: {
          totalStudents,
          presentCount: todayPresentCount,
          absentCount: todayAbsentCount,
          unknownCount: todayUnknownCount,
          attendanceRate: todayAttendanceRate,
          lateCount
        },
        departmentStats,
        attendanceTrend,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  markAttendance,
  getAttendanceLogs,
  manualCorrection,
  getDashboardStats,
};
