export class FinanceSheetsService {
  private static getSheetId(section: string): string {
    const sheetIds = {
      '2025Adults': '1uP3xkywry5K_Yo5K9yvviRI7bx6oC6JbYuEdMXTMNSg',
      '2025KidsTeens': '124RN9eEJ_uld7zUOC_ascolnZJpal8i5RCLnVpC8ye8',
      'Core Adults': '1avpggbRPDyXLZw0qNzm1DhHGghxw2cunTbHH4lZmWaY',
      'Core Teens Kids': '1LOcaZpx0lo54lm-AOanq7Y7MoXerteiNTbwgQFMiyCs'
    };
    return sheetIds[section as keyof typeof sheetIds] || sheetIds['Core Adults'];
  }
  
  private static getSheetName(section: string): string {
    const sheetNames = {
      '2025Adults': 'Sheet1',
      '2025KidsTeens': 'Sheet1',
      'Core Adults': 'Sheet1',
      'Core Teens Kids': 'Sheet1'
    };
    return sheetNames[section as keyof typeof sheetNames] || 'Sheet1';
  }
  
  private static getColumnInfo(section: string) {
    if (section === 'Core Teens Kids') {
      return { column: 'M', index: 12 }; // Column M (index 12)
    }
    if (section === '2025Adults') {
      return { column: 'J', index: 9 }; // Column J (index 9)
    }
    if (section === '2025KidsTeens') {
      return { column: 'F', index: 5 }; // Column F (index 5)
    }
    return { column: 'E', index: 4 }; // Column E (index 4) for Core Adults
  }
  
  static async updatePaymentStatus(data: {
    memberName: string;
    section: string;
    status: string;
    updatedBy: string;
  }, accessToken: string) {
    try {
      const sheetId = this.getSheetId(data.section);
      const sheetName = this.getSheetName(data.section);
      
      // Get all data to find the member's row
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const sheetData = await response.json();
      const rows = sheetData.values || [];
      
      // Find the member's row (name is in column C)
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) { // Skip header row
        if (rows[i][2] === data.memberName) { // Column C (index 2)
          rowIndex = i + 1; // Google Sheets is 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error(`Member ${data.memberName} not found in spreadsheet`);
      }

      // Update payment column based on section
      const columnInfo = this.getColumnInfo(data.section);
      const range = `${sheetName}!${columnInfo.column}${rowIndex}`;
      const values = [[data.status]];

      const updateResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values })
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Failed to update payment status: ${updateResponse.status}`);
      }

      return await updateResponse.json();
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }
  }

  static async getPaymentStatus(section: string, accessToken: string) {
    try {
      const sheetId = this.getSheetId(section);
      const sheetName = this.getSheetName(section);
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch payment status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];
      const columnInfo = this.getColumnInfo(section);
      
      // Skip header row and map payment records
      return rows.slice(1).map((row: string[]) => ({
        memberName: row[2] || '', // Column C
        status: row[columnInfo.index] || 'unpaid' // Dynamic column based on section
      }));
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return [];
    }
  }
}