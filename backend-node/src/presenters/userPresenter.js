import User from "../models/User.js";
import Department from "../models/Department.js";
import Project from "../models/Project.js";
import UserPreference from "../models/UserPreference.js";
import ActivityLog from "../models/ActivityLog.js";
import generateToken from "../utils/generateToken.js";
import generateRefreshToken from "../utils/generateRefreshToken.js";

// Hàm format user summary (cho danh sách)
const formatUserSummary = (user, department, projects) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  position: user.position,
  phone: user.phone,
  department: department
    ? {
        id: department._id,
        name: department.name,
        description: department.description,
      }
    : null,
  projects: projects
    ? projects.map((project) => ({
        id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
      }))
    : [],
});

// Hàm format user detail (chi tiết user)
const formatUserDetail = (user, department, projects) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  position: user.position,
  status: user.status,
  role: user.role,
  avatar: user.avatar,
  isVerified: user.isVerified,
  authProvider: user.authProvider,
  department: department
    ? {
        id: department._id,
        name: department.name,
        description: department.description,
      }
    : null,
  projects: projects
    ? projects.map((project) => ({
        id: project._id,
        name: project.name,
        description: project.description,
        status: project.status,
      }))
    : [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getUsers = async (req, res) => {
  try {
    const {
      keyword,
      departmentId,
      fullName,
      email,
      phone,
      position,
      role,
      status,
      page = 1,
      size = 10,
    } = req.query;

    const filter = {};
    if (keyword) {
      filter.$or = [
        { fullName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phone: { $regex: keyword, $options: "i" } },
      ];
    }
    if (departmentId) filter.departmentId = departmentId;
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (fullName) filter.fullName = { $regex: fullName, $options: "i" };
    if (phone) filter.phone = { $regex: phone, $options: "i" };
    if (position) filter.position = { $regex: position, $options: "i" };

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [users, totalElements] = await Promise.all([
      User.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    // Populate department and projects for each user
    const content = await Promise.all(
      users.map(async (user) => {
        let department = null;
        if (user.departmentId) {
          department = await Department.findById(user.departmentId);
        }

        // Find projects where this user is a member
        const projects = await Project.find({
          "members.userId": user._id,
        }).select("_id name description status");

        return formatUserSummary(user, department, projects);
      }),
    );

    res.status(200).json({
      content,
      totalElements,
      totalPages,
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("GetUsers error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, fullName, phone, position, departmentId, role } =
      req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "Email, password, and fullName are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      phone: phone || "",
      position: position || "",
      departmentId: departmentId || null,
      role: role || "user",
      isVerified: true, // Admin-created users are pre-verified
    });

    res.status(201).json({
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  } catch (error) {
    console.error("CreateUser error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get department info
    let department = null;
    if (user.departmentId) {
      department = await Department.findById(user.departmentId);
    }

    // Get projects where this user is a member
    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    res.status(200).json(formatUserDetail(user, department, projects));
  } catch (error) {
    console.error("GetUserById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, position, departmentId, role, status } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update allowed fields
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (position !== undefined) user.position = position;
    if (departmentId !== undefined) user.departmentId = departmentId;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;

    await user.save();

    // Get department and projects info
    let department = null;
    if (user.departmentId) {
      department = await Department.findById(user.departmentId);
    }
    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    res.status(200).json(formatUserDetail(user, department, projects));
  } catch (error) {
    console.error("UpdateUser error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /users/:id - Xóa người dùng (bởi admin)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DeleteUser error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get department and projects info
    let department = null;
    if (user.departmentId) {
      department = await Department.findById(user.departmentId);
    }
    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    res.status(200).json(formatUserDetail(user, department, projects));
  } catch (error) {
    console.error("GetMe error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, position } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only allow updating these fields for personal profile
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (position !== undefined) user.position = position;

    await user.save();

    // Get department and projects info
    let department = null;
    if (user.departmentId) {
      department = await Department.findById(user.departmentId);
    }
    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    res.status(200).json(formatUserDetail(user, department, projects));
  } catch (error) {
    console.error("UpdateProfile error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Avatar file is required" });
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res
        .status(400)
        .json({ message: "File size must be less than 5MB" });
    }

    // Validate file type
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Only image files are allowed" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Build avatar URL (assuming files are served from /uploads/ path)
    const avatarUrl = `/uploads/${req.file.filename}`;
    user.avatar = avatarUrl;

    await user.save();

    res.status(200).json({
      avatarUrl: user.avatar,
    });
  } catch (error) {
    console.error("UpdateAvatar error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /users/me/preferences - Lấy cài đặt cá nhân
export const getPreferences = async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ userId: req.user._id });

    // If preferences don't exist, create default ones
    if (!preferences) {
      preferences = await UserPreference.create({
        userId: req.user._id,
      });
    }

    res.status(200).json({
      notifications: preferences.notifications,
      theme: preferences.theme,
      language: preferences.language,
    });
  } catch (error) {
    console.error("GetPreferences error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /users/me/preferences - Cập nhật cài đặt cá nhân
export const updatePreferences = async (req, res) => {
  try {
    const { notifications, theme, language } = req.body;

    const preferences = await UserPreference.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          ...(notifications && { notifications }),
          ...(theme && { theme }),
          ...(language && { language }),
        },
      },
      { 
        upsert: true, // Create if not exists
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error("UpdatePreferences error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /users/:id/activities - Lấy nhật ký hoạt động của user
export const getUserActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, targetType, page = 1, size = 10 } = req.query;

    // Build filter object
    const filter = { userId: id };
    if (action) filter.action = action;
    if (targetType) filter.targetType = targetType;

    // Validate user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [activities, totalElements] = await Promise.all([
      ActivityLog.find(filter)
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 }),
      ActivityLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    res.status(200).json({
      content: activities,
      totalElements,
      totalPages,
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("GetUserActivities error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
