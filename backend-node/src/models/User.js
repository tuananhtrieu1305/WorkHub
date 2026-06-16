import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const profileLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: [80, "Link label must be at most 80 characters"],
      default: "",
    },
    url: {
      type: String,
      trim: true,
      maxlength: [500, "Link URL must be at most 500 characters"],
      default: "",
    },
    type: {
      type: String,
      enum: ["website", "blog", "portfolio", "social", "app", "other"],
      default: "other",
    },
  },
  { _id: false },
);

const profileThemeSchema = new mongoose.Schema(
  {
    useBannerImage: {
      type: Boolean,
      default: true,
    },
    preset: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "aurora",
    },
    accentColor: {
      type: String,
      trim: true,
      maxlength: 16,
      default: "#0f766e",
    },
    backgroundColor: {
      type: String,
      trim: true,
      maxlength: 16,
      default: "#ccfbf1",
    },
    textColor: {
      type: String,
      trim: true,
      maxlength: 16,
      default: "#134e4a",
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [50, "Full name must be at most 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [
        function () {
          return !this.googleId;
        },
        "Password is required",
      ],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    phone: {
      type: String,
      default: "",
    },
    position: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [160, "Bio must be at most 160 characters"],
      default: "",
    },
    about: {
      type: String,
      trim: true,
      maxlength: [1500, "About must be at most 1500 characters"],
      default: "",
    },
    location: {
      type: String,
      trim: true,
      maxlength: [120, "Location must be at most 120 characters"],
      default: "",
    },
    birthday: {
      type: Date,
      default: null,
    },
    pronouns: {
      type: String,
      trim: true,
      maxlength: [80, "Pronouns must be at most 80 characters"],
      default: "",
    },
    education: {
      type: String,
      trim: true,
      maxlength: [300, "Education must be at most 300 characters"],
      default: "",
    },
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: (items) =>
          items.length <= 20 && items.every((item) => item.length <= 60),
        message: "Interests must contain at most 20 items under 60 characters",
      },
    },
    socialLinks: {
      type: [profileLinkSchema],
      default: [],
      validate: {
        validator: (links) => links.length <= 10,
        message: "Profile links must contain at most 10 items",
      },
    },
    profileBannerUrl: {
      type: String,
      trim: true,
      default: "",
    },
    profileBannerStorageKey: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    profileTheme: {
      type: profileThemeSchema,
      default: () => ({}),
    },
    activeOrganizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "locked", "disabled"],
      default: "active",
    },
    activityStatus: {
      type: String,
      enum: ["online", "idle", "dnd", "invisible"],
      default: "online",
    },
    activityStatusExpiresAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lockReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOTP: {
      type: String,
      select: false,
    },
    verificationOTPExpires: {
      type: Date,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
