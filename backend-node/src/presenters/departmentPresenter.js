import Department from "../models/Department.js";
import User from "../models/User.js";

// GET /departments
export const getDepartments = async (req, res) => {
  try {
    const { keyword, page = 1, size = 10 } = req.query;

    const filter = {};
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [departments, totalElements] = await Promise.all([
      Department.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Department.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    // Populate manager info
    const content = await Promise.all(
      departments.map(async (dept) => {
        let manager = null;
        if (dept.managerId) {
          manager = await User.findById(dept.managerId).select("_id fullName email avatar");
        }
        const memberCount = await User.countDocuments({ departmentId: dept._id });
        return {
          id: dept._id,
          name: dept.name,
          description: dept.description,
          parentId: dept.parentId,
          manager,
          memberCount,
          createdAt: dept.createdAt,
          updatedAt: dept.updatedAt,
        };
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetDepartments error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /departments
export const createDepartment = async (req, res) => {
  try {
    const { name, description, parentId, managerId } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Department name is required" });
    }

    if (parentId) {
      const parent = await Department.findById(parentId);
      if (!parent) return res.status(404).json({ message: "Parent department not found" });
    }

    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) return res.status(404).json({ message: "Manager user not found" });
    }

    const department = await Department.create({
      name,
      description: description || "",
      parentId: parentId || null,
      managerId: managerId || null,
    });

    res.status(201).json({
      id: department._id,
      name: department.name,
      description: department.description,
      parentId: department.parentId,
      managerId: department.managerId,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    });
  } catch (error) {
    console.error("CreateDepartment error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /departments/:id
export const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    let manager = null;
    if (department.managerId) {
      manager = await User.findById(department.managerId).select("_id fullName email avatar");
    }

    const members = await User.find({ departmentId: department._id }).select(
      "_id fullName email avatar position status"
    );

    // Get sub-departments
    const subDepartments = await Department.find({ parentId: department._id }).select(
      "_id name description"
    );

    res.status(200).json({
      id: department._id,
      name: department.name,
      description: department.description,
      parentId: department.parentId,
      manager,
      members,
      subDepartments,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    });
  } catch (error) {
    console.error("GetDepartmentById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid department ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /departments/:id
export const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    const { name, description, parentId, managerId } = req.body;

    if (parentId !== undefined) {
      if (parentId && parentId.toString() === department._id.toString()) {
        return res.status(400).json({ message: "Department cannot be its own parent" });
      }
      if (parentId) {
        const parent = await Department.findById(parentId);
        if (!parent) return res.status(404).json({ message: "Parent department not found" });
      }
      department.parentId = parentId || null;
    }

    if (managerId !== undefined) {
      if (managerId) {
        const manager = await User.findById(managerId);
        if (!manager) return res.status(404).json({ message: "Manager user not found" });
      }
      department.managerId = managerId || null;
    }

    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;

    await department.save();

    res.status(200).json({
      id: department._id,
      name: department.name,
      description: department.description,
      parentId: department.parentId,
      managerId: department.managerId,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    });
  } catch (error) {
    console.error("UpdateDepartment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid department ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /departments/:id
export const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Reset departmentId for all users in this department
    await User.updateMany({ departmentId: department._id }, { departmentId: null });

    // Reset parentId for sub-departments
    await Department.updateMany({ parentId: department._id }, { parentId: null });

    await Department.findByIdAndDelete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error("DeleteDepartment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid department ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /departments/:id/members
export const getDepartmentMembers = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const filter = { departmentId: department._id };

    const [members, totalElements] = await Promise.all([
      User.find(filter)
        .select("_id fullName email avatar position status role")
        .skip(skip)
        .limit(pageSize)
        .sort({ fullName: 1 }),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    res.status(200).json({
      content: members,
      totalElements,
      totalPages,
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("GetDepartmentMembers error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid department ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /departments/:id/members
export const addDepartmentMember = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.departmentId && user.departmentId.toString() === department._id.toString()) {
      return res.status(400).json({ message: "User is already a member of this department" });
    }

    // Update user's departmentId
    user.departmentId = department._id;
    await user.save();

    res.status(200).json({ message: "Member added to department successfully" });
  } catch (error) {
    console.error("AddDepartmentMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /departments/:id/members/:userId
export const removeDepartmentMember = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.departmentId || user.departmentId.toString() !== department._id.toString()) {
      return res.status(400).json({ message: "User is not a member of this department" });
    }

    // Reset user's departmentId
    user.departmentId = null;
    await user.save();

    res.status(204).send();
  } catch (error) {
    console.error("RemoveDepartmentMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
