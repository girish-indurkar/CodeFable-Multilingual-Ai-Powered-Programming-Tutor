const express = require('express');
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');
const { generateExplanation } = require('../services/ai');

const router = express.Router();

// Explain DSA Problem or Code
router.post('/explain', authMiddleware, async (req, res) => {
  try {
    const { inputText, language } = req.body;

    if (!inputText || !language) {
      return res.status(400).json({ error: 'Input text and language are required' });
    }

    const aiResponse = await generateExplanation(inputText, language);

    // Save history
    const { data: history, error: insertError } = await supabase
      .from('history')
      .insert([
        {
          user_id: req.user.userId,
          input_text: inputText,
          language,
          ai_response: aiResponse,
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Insert history error:', insertError);
      // We don't want to fail the whole request if history save fails, but let's log it
    }

    res.json({ aiResponse, historyId: history ? history.id : null });
  } catch (error) {
    console.error('Explain route error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate explanation' });
  }
});

// Get User History
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { data: history, error: fetchError } = await supabase
      .from('history')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (fetchError) {
      console.error('Fetch history error:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }
    
    res.json(history);
  } catch (error) {
    console.error('History route error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
