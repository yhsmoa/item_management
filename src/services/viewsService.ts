interface ViewsData {
  productId: string;
  productViews: string;
}

interface ViewsDocument {
  user_id: string;
  date: string;
  views: ViewsData[];
  created_at: string;
}

export class ViewsService {
  async saveViewsData(viewsDataArray: ViewsData[], date: string, userId?: string) {
    try {
      const documentToInsert = {
        user_id: userId || 'unknown',
        date: date,
        views: viewsDataArray
      };

      console.log('전송할 데이터:', documentToInsert);

      const response = await fetch('http://localhost:3001/api/views/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: documentToInsert
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`조회수 데이터가 저장되었습니다.`);
        return {
          success: true,
          insertedCount: viewsDataArray.length,
          insertedIds: result.insertedIds
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('조회수 데이터 저장 중 오류:', error);
      return {
        success: false,
        error: error
      };
    }
  }

  async getViewsData(userId: string, date: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/get/${userId}/${date}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('조회수 데이터 조회 완료:', result.data);
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('조회수 데이터 조회 중 오류:', error);
      return {
        success: false,
        error: error,
        data: []
      };
    }
  }

  async getRecentViewsData(userId: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/get-recent/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('최근 5개 날짜 조회수 데이터 조회 완료:', result.data);
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('최근 조회수 데이터 조회 중 오류:', error);
      return {
        success: false,
        error: error,
        data: []
      };
    }
  }

  async getViewsDateRange(userId: string, startDate: string, endDate: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/get-date-range/${userId}/${startDate}/${endDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('날짜 범위 조회수 데이터 조회 완료:', result.data);
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('날짜 범위 조회수 데이터 조회 중 오류:', error);
      return {
        success: false,
        error: error,
        data: []
      };
    }
  }

  async getAvailableDates(userId: string, startDate: string, endDate: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/get-available-dates/${userId}/${startDate}/${endDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('사용 가능한 날짜 조회 완료:', result.data);
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('사용 가능한 날짜 조회 중 오류:', error);
      return {
        success: false,
        error: error,
        data: []
      };
    }
  }

  async deleteViewsData(userId: string, date: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/delete/${userId}/${date}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('조회수 데이터 삭제 완료:', result.message);
        return {
          success: true,
          message: result.message
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('조회수 데이터 삭제 중 오류:', error);
      return {
        success: false,
        error: error
      };
    }
  }

  async deleteAllViewsData(userId: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/views/delete-all/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('전체 조회수 데이터 삭제 완료:', result.message);
        return {
          success: true,
          message: result.message,
          deletedCount: result.deletedCount
        };
      } else {
        throw new Error(result.message || '서버 오류');
      }
    } catch (error) {
      console.error('전체 조회수 데이터 삭제 중 오류:', error);
      return {
        success: false,
        error: error
      };
    }
  }

  parseViewsData(rawData: string): ViewsData[] {
    try {
      // 객체 형태 데이터 파싱을 위한 정규식
      const objectRegex = /\{productId:\s*['"]([^'"]+)['"],\s*productViews:\s*['"]([^'"]+)['"]\}/g;
      const viewsArray: ViewsData[] = [];
      
      let match;
      while ((match = objectRegex.exec(rawData)) !== null) {
        const productId = match[1];
        const productViews = match[2];
        
        if (productId && productViews) {
          viewsArray.push({
            productId: productId,
            productViews: productViews
          });
        }
      }
      
      // 만약 정규식으로 파싱이 안 된다면 줄별로 파싱 시도
      if (viewsArray.length === 0) {
        const lines = rawData.split('\n').filter(line => line.trim());
        let currentItem: Partial<ViewsData> = {};
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.includes('productId:')) {
            const match = trimmedLine.match(/productId:\s*['"]([^'"]+)['"]/);
            if (match) {
              currentItem.productId = match[1];
            }
          }
          
          if (trimmedLine.includes('productViews:')) {
            const match = trimmedLine.match(/productViews:\s*['"]([^'"]+)['"]/);
            if (match) {
              currentItem.productViews = match[1];
              
              if (currentItem.productId && currentItem.productViews) {
                viewsArray.push({
                  productId: currentItem.productId,
                  productViews: currentItem.productViews
                });
                currentItem = {};
              }
            }
          }
        }
      }
      
      console.log('파싱된 데이터:', viewsArray);
      return viewsArray;
    } catch (error) {
      console.error('데이터 파싱 중 오류:', error);
      return [];
    }
  }
}

export const viewsService = new ViewsService();