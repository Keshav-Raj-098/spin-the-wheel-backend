// pages/api/sendEmail.js
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, otp } = req.body;

    // Your email sending logic with nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.PRASOON_EMAIL_USER ,
        pass: process.env.PRASOON_EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: 'OTP sent successfully' });


    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}