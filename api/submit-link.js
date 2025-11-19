export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, clipType, description, fileName, submissionId, megaLink } = req.body;

    console.log('🎬 MEGA Link Received:', {
      submissionId,
      fileName, 
      megaLink,
      from: `${name} (${email})`
    });

    // Qui puoi salvare i dati in un database o inviare notifiche
    // Per ora semplicemente logghiamo

    res.status(200).json({ 
      success: true, 
      message: 'MEGA link received successfully',
      submissionId: submissionId
    });

  } catch (error) {
    console.error('Error processing MEGA link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}