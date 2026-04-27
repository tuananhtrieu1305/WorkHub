import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";

// GET /projects
export const getProjects = async (req, res) => {
  try {
    const { keyword, status, departmentId, page = 1, size = 10 } = req.query;

    const filter = {};
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { description: { $regex: keyword, $options: "i" } },
      ];
    }
    if (status) filter.status = status;
    if (departmentId) filter.departmentIds = departmentId;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [projects, totalElements] = await Promise.all([
      Project.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Project.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = projects.map((p) => ({
      id: p._id,
      name: p.name,
      description: p.description,
      status: p.status,
      memberCount: p.members.length,
      startDate: p.startDate,
      endDate: p.endDate,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
    }));

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetProjects error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /projects
export const createProject = async (req, res) => {
  try {
    const { name, description, departmentIds, startDate, endDate, status } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const project = await Project.create({
      name,
      description: description || "",
      departmentIds: departmentIds || [],
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || "active",
      createdBy: req.user._id,
      members: [{ userId: req.user._id, role: "lead" }],
    });

    res.status(201).json({
      id: project._id,
      name: project.name,
      description: project.description,
      departmentIds: project.departmentIds,
      status: project.status,
      members: project.members,
      startDate: project.startDate,
      endDate: project.endDate,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error("CreateProject error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /projects/:id
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Populate member details
    const membersWithDetails = await Promise.all(
      project.members.map(async (member) => {
        const user = await User.findById(member.userId).select(
          "_id fullName email avatar position"
        );
        return {
          userId: member.userId,
          role: member.role,
          user,
        };
      })
    );

    res.status(200).json({
      id: project._id,
      name: project.name,
      description: project.description,
      departmentIds: project.departmentIds,
      status: project.status,
      members: membersWithDetails,
      startDate: project.startDate,
      endDate: project.endDate,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error("GetProjectById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /projects/:id
export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const { name, description, departmentIds, startDate, endDate, status } = req.body;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (departmentIds !== undefined) project.departmentIds = departmentIds;
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;
    if (status !== undefined) project.status = status;

    await project.save();

    res.status(200).json({
      id: project._id,
      name: project.name,
      description: project.description,
      departmentIds: project.departmentIds,
      status: project.status,
      members: project.members,
      startDate: project.startDate,
      endDate: project.endDate,
      createdBy: project.createdBy,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error("UpdateProject error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /projects/:id (admin only)
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Also delete related tasks
    await Task.deleteMany({ projectId: project._id });

    await Project.findByIdAndDelete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error("DeleteProject error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /projects/:id/members
export const getProjectMembers = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const membersWithDetails = await Promise.all(
      project.members.map(async (member) => {
        const user = await User.findById(member.userId).select(
          "_id fullName email avatar position"
        );
        return {
          userId: member.userId,
          role: member.role,
          joinedAt: member._id.getTimestamp(),
          user,
        };
      })
    );

    res.status(200).json(membersWithDetails);
  } catch (error) {
    console.error("GetProjectMembers error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /projects/:id/members (only project creator)
export const addProjectMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Only project creator can manage members
    if (project.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only project creator can manage members" });
    }

    const { userId, role } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already a member
    const existingMember = project.members.find(
      (m) => m.userId.toString() === userId.toString()
    );
    if (existingMember) {
      return res.status(400).json({ message: "User is already a member of this project" });
    }

    project.members.push({ userId, role: role || "member" });
    await project.save();

    res.status(200).json({ message: "Member added to project successfully" });
  } catch (error) {
    console.error("AddProjectMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /projects/:id/members/:userId (only project creator)
export const updateProjectMemberRole = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only project creator can manage members" });
    }

    const { role } = req.body;
    const { userId } = req.params;

    if (!role) {
      return res.status(400).json({ message: "role is required" });
    }

    const memberIndex = project.members.findIndex(
      (m) => m.userId.toString() === userId.toString()
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Member not found in this project" });
    }

    project.members[memberIndex].role = role;
    await project.save();

    res.status(200).json({ message: "Member role updated successfully" });
  } catch (error) {
    console.error("UpdateProjectMemberRole error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /projects/:id/members/:userId (only project creator)
export const removeProjectMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only project creator can manage members" });
    }

    const { userId } = req.params;

    const memberIndex = project.members.findIndex(
      (m) => m.userId.toString() === userId.toString()
    );

    if (memberIndex === -1) {
      return res.status(404).json({ message: "Member not found in this project" });
    }

    // Prevent removing the creator
    if (userId.toString() === project.createdBy.toString()) {
      return res.status(400).json({ message: "Cannot remove the project creator" });
    }

    project.members.splice(memberIndex, 1);
    await project.save();

    res.status(204).send();
  } catch (error) {
    console.error("RemoveProjectMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /projects/:id/tasks
export const getProjectTasks = async (req, res) => {
  try {
    const { status, assigneeId, page = 1, size = 10 } = req.query;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const filter = { projectId: project._id };
    if (status) filter.status = status;
    if (assigneeId) filter.assignees = assigneeId;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [tasks, totalElements] = await Promise.all([
      Task.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Task.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = tasks.map((t) => ({
      id: t._id,
      title: t.title,
      description: t.description,
      status: t.status,
      assignees: t.assignees,
      createdBy: t.createdBy,
      endAt: t.endAt,
      createdAt: t.createdAt,
    }));

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetProjectTasks error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
