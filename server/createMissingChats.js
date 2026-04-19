import mongoose from "mongoose";
import dotenv from "dotenv";
import { assignmentSchema } from "./schemas/assignmentSchema.js";
import { groupChatSchema } from "./schemas/groupChatSchema.js";
import { teacherSchema } from "./schemas/teacherSchema.js";
import { studentSchema } from "./schemas/studentSchema.js";

dotenv.config();

const createMissingChats = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    const Assignment = mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);
    const GroupChat  = mongoose.models.GroupChat  || mongoose.model("GroupChat",  groupChatSchema);
    const Teacher    = mongoose.models.Teacher    || mongoose.model("Teacher",    teacherSchema);
    const Student    = mongoose.models.Student    || mongoose.model("Student",    studentSchema);

    // Get all assignments
    const assignments = await Assignment.find();
    console.log(`📋 Found ${assignments.length} assignments`);

    let created = 0;
    let skipped = 0;

    for (const assignment of assignments) {
      // Check if chat already exists
      const existingChat = await GroupChat.findOne({ 
        assignmentId: assignment._id 
      });

      if (existingChat) {
        console.log(`⏭️  Chat already exists for assignment ${assignment._id}`);
        skipped++;
        continue;
      }

      // Get teacher and student details
      const teacher = await Teacher.findById(assignment.teacherId);
      const student = await Student.findById(assignment.studentId);

      if (!teacher || !student) {
        console.log(`❌ Missing teacher or student for assignment ${assignment._id}`);
        continue;
      }

      const chatName = `${teacher.firstName} ${teacher.lastName} - ${student.firstName} ${student.lastName}`;

      // Create the chat
      await GroupChat.create({
        assignmentId: assignment._id,
        teacherId: assignment.teacherId,
        studentId: assignment.studentId,
        chatName: chatName,
        messages: [{
          senderId: assignment.teacherId,
          senderModel: 'Teacher',
          senderName: 'System',
          senderRole: 'admin',
          message: `Chat created for ${chatName}. Welcome to your learning journey! 🎓`,
          messageType: 'system',
          createdAt: new Date()
        }],
        isActive: true,
        lastActivityAt: new Date()
      });

      console.log(`✅ Created chat for: ${chatName}`);
      created++;
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Created: ${created} chats`);
    console.log(`⏭️  Skipped: ${skipped} chats (already exist)`);
    console.log(`📋 Total: ${assignments.length} assignments`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

createMissingChats();