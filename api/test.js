export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'API IS WORKING!',
    timestamp: new Date().toISOString()
  });
}
