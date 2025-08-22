const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

const MONGODB_URI = process.env.MONGODB_URI || '';

// 조회수 데이터 저장 API
router.post('/save', async (req, res) => {
  let client;
  
  try {
    const { data } = req.body;
    console.log('받은 데이터:', JSON.stringify(data, null, 2));
    
    if (!data || !data.user_id || !data.date || !data.views || !Array.isArray(data.views)) {
      return res.status(400).json({
        success: false,
        message: '올바른 데이터를 제공해주세요. (user_id, date, views 필요)'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 동일한 user_id와 date가 있는지 확인하고 upsert
    const filter = { 
      user_id: data.user_id, 
      date: data.date 
    };
    
    const updateDoc = {
      $set: {
        user_id: data.user_id,
        date: data.date,
        views: data.views
      }
    };

    // upsert: 있으면 업데이트, 없으면 삽입
    const result = await collection.updateOne(filter, updateDoc, { upsert: true });
    
    // productId에 인덱스 생성 (views 배열 내의 productId)
    await collection.createIndex({ "views.productId": 1 });
    await collection.createIndex({ "user_id": 1, "date": 1 });
    
    res.json({
      success: true,
      insertedCount: result.upsertedCount || 1,
      insertedIds: result.upsertedId ? [result.upsertedId] : [],
      message: result.upsertedCount > 0 ? '새 데이터가 저장되었습니다.' : '기존 데이터가 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('조회수 데이터 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 조회수 데이터 조회 API
router.get('/get/:userId/:date', async (req, res) => {
  let client;
  
  try {
    const { userId, date } = req.params;
    console.log(`조회수 데이터 조회 요청: userId=${userId}, date=${date}`);
    
    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        message: 'userId와 date 파라미터가 필요합니다.'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 해당 user_id와 date로 데이터 조회
    const document = await collection.findOne({
      user_id: userId,
      date: date
    });

    if (!document) {
      return res.json({
        success: true,
        data: [],
        message: '해당 날짜에 조회수 데이터가 없습니다.'
      });
    }

    res.json({
      success: true,
      data: document.views || [],
      message: '조회수 데이터 조회 완료'
    });

  } catch (error) {
    console.error('조회수 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 최근 5개 날짜의 조회수 데이터 조회 API
router.get('/get-recent/:userId', async (req, res) => {
  let client;
  
  try {
    const { userId } = req.params;
    console.log(`최근 5개 날짜 조회수 데이터 조회 요청: userId=${userId}`);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId 파라미터가 필요합니다.'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 해당 user_id의 최근 5개 날짜 데이터 조회
    const documents = await collection
      .find({ user_id: userId })
      .sort({ date: -1 }) // 날짜 내림차순 정렬 (최신 먼저)
      .limit(5)
      .toArray();

    if (!documents || documents.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: '조회수 데이터가 없습니다.'
      });
    }

    // 날짜별로 데이터 정리 (최신 날짜가 마지막에 오도록)
    const sortedDocuments = documents.reverse(); // 오름차순으로 변경 (오래된 것부터)
    
    res.json({
      success: true,
      data: sortedDocuments,
      message: '최근 5개 날짜 조회수 데이터 조회 완료'
    });

  } catch (error) {
    console.error('최근 조회수 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 날짜 범위 조회수 데이터 조회 API
router.get('/get-date-range/:userId/:startDate/:endDate', async (req, res) => {
  let client;
  
  try {
    const { userId, startDate, endDate } = req.params;
    console.log(`날짜 범위 조회수 데이터 조회 요청: userId=${userId}, startDate=${startDate}, endDate=${endDate}`);
    
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, startDate, endDate 파라미터가 모두 필요합니다.'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 해당 user_id와 날짜 범위에 해당하는 데이터 조회
    const documents = await collection
      .find({ 
        user_id: userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ date: 1 }) // 날짜 오름차순 정렬
      .toArray();

    if (!documents || documents.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: '해당 기간에 조회수 데이터가 없습니다.'
      });
    }

    // views 배열의 각 productId별로 날짜와 조회수를 평면화
    const flattenedData = [];
    documents.forEach(doc => {
      if (doc.views && Array.isArray(doc.views)) {
        doc.views.forEach(view => {
          flattenedData.push({
            date: doc.date,
            productId: view.productId,
            productViews: view.productViews
          });
        });
      }
    });
    
    res.json({
      success: true,
      data: flattenedData,
      message: '날짜 범위 조회수 데이터 조회 완료'
    });

  } catch (error) {
    console.error('날짜 범위 조회수 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 사용자의 존재하는 날짜 목록 조회 API
router.get('/get-available-dates/:userId/:startDate/:endDate', async (req, res) => {
  let client;
  
  try {
    const { userId, startDate, endDate } = req.params;
    console.log(`사용 가능한 날짜 조회 요청: userId=${userId}, startDate=${startDate}, endDate=${endDate}`);
    
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, startDate, endDate 파라미터가 모두 필요합니다.'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 해당 user_id와 날짜 범위에 해당하는 date 목록만 조회
    const dates = await collection
      .find({ 
        user_id: userId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }, 
      { 
        projection: { date: 1, _id: 0 } // date 필드만 조회
      })
      .sort({ date: 1 }) // 날짜 오름차순 정렬
      .toArray();

    // date 값만 추출
    const availableDates = dates.map(doc => doc.date);
    
    res.json({
      success: true,
      data: availableDates,
      message: '사용 가능한 날짜 목록 조회 완료'
    });

  } catch (error) {
    console.error('사용 가능한 날짜 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 조회수 데이터 삭제 API
router.delete('/delete/:userId/:date', async (req, res) => {
  let client;
  
  try {
    const { userId, date } = req.params;
    console.log(`조회수 데이터 삭제 요청: userId=${userId}, date=${date}`);
    
    if (!userId || !date) {
      return res.status(400).json({
        success: false,
        message: 'userId와 date 파라미터가 필요합니다.'
      });
    }

    // MongoDB 연결
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('coupang_views');
    const collection = db.collection('views');

    // 해당 user_id와 date의 document 삭제
    const result = await collection.deleteOne({
      user_id: userId,
      date: date
    });

    if (result.deletedCount === 0) {
      return res.json({
        success: false,
        message: '삭제할 데이터가 없습니다.'
      });
    }
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: '조회수 데이터가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('조회수 데이터 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

module.exports = router;