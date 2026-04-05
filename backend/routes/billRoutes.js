/**
 * Bill routes — create bills for logged-in user; list bills only for own userId (JWT must match).
 */
const express = require("express");
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// POST /add-bill — body: items, total, date (optional), rate, format, paid, due (optional)
router.post("/add-bill", authMiddleware, async (req, res) => {
  try {
    const { items, total, date, rate, format, paid, due } = req.body;
    const userId = req.user.userId;

    if (total === undefined || total === null) {
      return res.status(400).json({
        success: false,
        message: "Total is required.",
      });
    }

    const billDate = date ? new Date(date) : new Date();
    if (Number.isNaN(billDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date.",
      });
    }

    const bill = await Bill.create({
      userId,
      items: Array.isArray(items) ? items : [],
      total: Number(total),
      date: billDate,
      rate: rate !== undefined ? Number(rate) : undefined,
      format: format !== undefined ? String(format) : undefined,
      paid: paid !== undefined ? Number(paid) : undefined,
      due: due !== undefined ? Number(due) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: "Bill saved.",
      bill: formatBillResponse(bill),
    });
  } catch (err) {
    console.error("Add bill error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Could not save bill.",
    });
  }
});

// GET /bills/:userId — only if JWT userId matches :userId (users see only their data)
router.get("/bills/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId: paramId } = req.params;
    const tokenUserId = req.user.userId;

    if (paramId !== tokenUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own bills.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(paramId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id.",
      });
    }

    const bills = await Bill.find({ userId: paramId })
      .sort({ date: -1 })
      .lean();

    return res.json({
      success: true,
      bills: bills.map((b) => formatBillResponse(b)),
    });
  } catch (err) {
    console.error("List bills error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Could not load bills.",
    });
  }
});

// PATCH /bills/:billId — update paid/due after "Pay" on bill screen (optional but needed for parity with old app)
router.patch("/bills/:billId", authMiddleware, async (req, res) => {
  try {
    const { billId } = req.params;
    const { paid, due } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill id.",
      });
    }

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found.",
      });
    }

    if (String(bill.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own bills.",
      });
    }

    if (paid !== undefined) bill.paid = Number(paid);
    if (due !== undefined) bill.due = Number(due);
    await bill.save();

    return res.json({
      success: true,
      message: "Bill updated.",
      bill: formatBillResponse(bill),
    });
  } catch (err) {
    console.error("Patch bill error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Could not update bill.",
    });
  }
});

/** Shape bill for JSON (consistent _id as string). */
function formatBillResponse(bill) {
  const doc = bill.toObject ? bill.toObject() : { ...bill };
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    items: doc.items || [],
    total: doc.total,
    date: doc.date,
    rate: doc.rate,
    format: doc.format,
    paid: doc.paid,
    due: doc.due,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

module.exports = router;
