'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PayrollTracker() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentEntry, setCurrentEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    hours: '',
    tips: '',
    isHoliday: false
  });
  const [editingId, setEditingId] = useState(null);
  const [hourlyRate, setHourlyRate] = useState(17.20);
  const [deductions, setDeductions] = useState({
    cpp: 1.64,
    ei: 1.64,
    tax: 4.94,
  });
  const [viewMode, setViewMode] = useState('recent');
  const [viewPeriod, setViewPeriod] = useState('2weeks');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      const saved = localStorage.getItem('payrollEntries');
      if (saved) {
        setEntries(JSON.parse(saved));
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return '';
    
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    let hours = endHour - startHour;
    let minutes = endMin - startMin;
    
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    
    if (hours < 0) {
      hours += 24;
    }
    
    return (hours + minutes / 60).toFixed(2);
  };

  const handleTimeChange = (field, value) => {
    const updated = { ...currentEntry, [field]: value };
    
    if (field === 'startTime' || field === 'endTime') {
      const calculatedHours = calculateHours(
        field === 'startTime' ? value : currentEntry.startTime,
        field === 'endTime' ? value : currentEntry.endTime
      );
      updated.hours = calculatedHours;
    }
    
    setCurrentEntry(updated);
  };

  const saveEntry = async () => {
    if (!currentEntry.hours || parseFloat(currentEntry.hours) <= 0) {
      alert('근무 시간을 입력해주세요!');
      return;
    }

    const grossPay = parseFloat(currentEntry.hours) * hourlyRate * (currentEntry.isHoliday ? 1.5 : 1);
    const totalDeductionRate = (deductions.cpp + deductions.ei + deductions.tax) / 100;
    const totalDeductions = grossPay * totalDeductionRate;
    const netPay = grossPay - totalDeductions;

    const entryData = {
      date: currentEntry.date,
      start_time: currentEntry.startTime,
      end_time: currentEntry.endTime,
      hours: parseFloat(currentEntry.hours),
      tips: parseFloat(currentEntry.tips) || 0,
      is_holiday: currentEntry.isHoliday,
      gross_pay: grossPay,
      deductions: totalDeductions,
      net_pay: netPay
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('payroll_entries')
          .update(entryData)
          .eq('id', editingId);

        if (error) throw error;
        alert('수정 성공! ✅');
        setEditingId(null);
      } else {
        const { error } = await supabase
          .from('payroll_entries')
          .insert([entryData])
          .select();

        if (error) throw error;
        alert('저장 성공! ✅');
      }

      await fetchEntries();
      
      setCurrentEntry({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        hours: '',
        tips: '',
        isHoliday: false
      });
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('저장 실패: ' + error.message);
    }
  };

  const deleteEntry = async (id) => {
    try {
      const { error } = await supabase
        .from('payroll_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchEntries();
      alert('삭제 성공! ✅');
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('삭제 실패: ' + error.message);
    }
  };

  const editEntry = (entry) => {
    setCurrentEntry({
      date: entry.date,
      startTime: entry.start_time || '',
      endTime: entry.end_time || '',
      hours: entry.hours.toString(),
      tips: entry.tips.toString(),
      isHoliday: entry.is_holiday
    });
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setCurrentEntry({
      date: new Date().toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      hours: '',
      tips: '',
      isHoliday: false
    });
    setEditingId(null);
  };

  const getFilteredEntries = () => {
    if (viewMode === 'custom' && customDateRange.start && customDateRange.end) {
      return entries.filter(e => {
        const entryDate = new Date(e.date);
        const startDate = new Date(customDateRange.start);
        const endDate = new Date(customDateRange.end);
        return entryDate >= startDate && entryDate <= endDate;
      });
    }
    
    const now = new Date();
    const daysAgo = viewPeriod === '2weeks' ? 14 : 28;
    const cutoffDate = new Date(now.setDate(now.getDate() - daysAgo));
    return entries.filter(e => new Date(e.date) >= cutoffDate);
  };

  const calculateStats = () => {
    const filtered = getFilteredEntries();
    const totalHours = filtered.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
    const regularHours = filtered.filter(e => !e.is_holiday).reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
    const holidayHours = filtered.filter(e => e.is_holiday).reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
    const totalGrossPay = filtered.reduce((sum, e) => sum + parseFloat(e.gross_pay || 0), 0);
    const totalDeductions = filtered.reduce((sum, e) => sum + parseFloat(e.deductions || 0), 0);
    const totalNetPay = filtered.reduce((sum, e) => sum + parseFloat(e.net_pay || 0), 0);
    const totalTips = filtered.reduce((sum, e) => sum + parseFloat(e.tips || 0), 0);
    
    return { totalHours, regularHours, holidayHours, totalGrossPay, totalDeductions, totalNetPay, totalTips };
  };

  const generateReport = () => {
    const filtered = getFilteredEntries().sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (filtered.length === 0) {
      alert('기록이 없습니다!');
      return;
    }

    // 1주 단위로 그룹화 (월요일 시작)
    const weeklyGroups = [];

    filtered.forEach(entry => {
      const [year, month, day] = entry.date.split('-').map(Number);
      const entryDate = new Date(year, month - 1, day);
      const dayOfWeek = entryDate.getDay();
      
      // 그 주의 월요일 찾기
      const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayDate = new Date(year, month - 1, day - daysFromMonday);
      
      // 주차 계산
      const reference = new Date(2024, 0, 1);
      const diffTime = mondayDate - reference;
      const weekNumber = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
      
      // 해당 주 찾기
      let group = weeklyGroups.find(g => g.weekNumber === weekNumber);
      if (!group) {
        group = { weekNumber, entries: [] };
        weeklyGroups.push(group);
      }
      
      group.entries.push(entry);
    });

    // 주차순 정렬
    weeklyGroups.sort((a, b) => a.weekNumber - b.weekNumber);

    let report = '';
    let grandTotal = 0;

weeklyGroups.forEach((group, index) => {
      const entries = group.entries;
      let weekTotal = 0;
      let holidayTotal = 0;
      
      // 홀리데이를 먼저, 그 다음 날짜순으로 정렬
      entries.sort((a, b) => {
        if (a.is_holiday && !b.is_holiday) return -1;
        if (!a.is_holiday && b.is_holiday) return 1;
        return a.date.localeCompare(b.date);
      });
      
      // 홀리데이 항목 먼저 출력
      const holidayEntries = entries.filter(e => e.is_holiday);
      holidayEntries.forEach(entry => {
        const [year, month, day] = entry.date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${month}/${day}`;
        
        const startTime = entry.start_time || '';
        const endTime = entry.end_time || '';
        const timeRange = startTime && endTime ? `${startTime}-${endTime}` : '';
        
        report += `${dateStr} ${dayName} ${timeRange} (${entry.hours}h) [홀리데이]\n`;
        holidayTotal += parseFloat(entry.hours || 0);
      });
      
      if (holidayTotal > 0) {
        report += `-> ${holidayTotal.toFixed(2)}h\n`;
      }
      
      // 일반 근무 항목 출력
      const regularEntries = entries.filter(e => !e.is_holiday);
      regularEntries.forEach(entry => {
        const [year, month, day] = entry.date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${month}/${day}`;
        
        const startTime = entry.start_time || '';
        const endTime = entry.end_time || '';
        const timeRange = startTime && endTime ? `${startTime}-${endTime}` : '';
        
        report += `${dateStr} ${dayName} ${timeRange} (${entry.hours}h)\n`;
        weekTotal += parseFloat(entry.hours || 0);
      });
      
      if (weekTotal > 0) {
        report += `-> ${weekTotal.toFixed(2)}hrs\n`;
      }
      
      grandTotal += weekTotal;
      
      // 2주마다 구분선 (홀수 인덱스 다음에)
      if (index % 2 === 1) {
        report += `--------------------------------\n`;
      }
    });

    report += `Total: ${grandTotal.toFixed(2)}h`;

    navigator.clipboard.writeText(report).then(() => {
      alert('리포트가 클립보드에 복사되었습니다! 📋');
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('리포트가 복사되었습니다! 📋');
    });
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-2xl font-bold text-gray-700">로딩 중...</div>
        </div>
      ) : (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <DollarSign className="text-green-600" />
            급여 관리 시스템
          </h1>
          <p className="text-gray-600 mb-6">레스토랑 근무 시간 및 팁 관리</p>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시급 설정 (CAD)
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">공제율 설정 (%)</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-600">CPP</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions.cpp}
                    onChange={(e) => setDeductions({...deductions, cpp: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">EI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions.ei}
                    onChange={(e) => setDeductions({...deductions, ei: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">소득세</label>
                  <input
                    type="number"
                    step="0.01"
                    value={deductions.tax}
                    onChange={(e) => setDeductions({...deductions, tax: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                총 공제율: {(deductions.cpp + deductions.ei + deductions.tax).toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                날짜
              </label>
              <input
                type="date"
                value={currentEntry.date}
                onChange={(e) => setCurrentEntry({...currentEntry, date: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  시작 시간
                </label>
                <input
                  type="time"
                  value={currentEntry.startTime}
                  onChange={(e) => handleTimeChange('startTime', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" />
                  끝 시간
                </label>
                <input
                  type="time"
                  value={currentEntry.endTime}
                  onChange={(e) => handleTimeChange('endTime', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                근무 시간 (자동 계산)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.hours}
                onChange={(e) => setCurrentEntry({...currentEntry, hours: e.target.value})}
                placeholder="자동으로 계산됩니다"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="inline w-4 h-4 mr-1" />
                팁 (CAD)
              </label>
              <input
                type="number"
                step="0.01"
                value={currentEntry.tips}
                onChange={(e) => setCurrentEntry({...currentEntry, tips: e.target.value})}
                placeholder="50.00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end md:col-span-2">
              <label className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition w-full justify-center">
                <input
                  type="checkbox"
                  checked={currentEntry.isHoliday}
                  onChange={(e) => setCurrentEntry({...currentEntry, isHoliday: e.target.checked})}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                />
                <span className="font-medium text-orange-700">홀리데이 (1.5배)</span>
              </label>
            </div>
          </div>

          <button
            onClick={saveEntry}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-md"
          >
            {editingId ? '✏️ 수정 완료' : '근무 기록 저장'}
          </button>
          
          {editingId && (
            <button
              onClick={cancelEdit}
              className="w-full mt-2 bg-gray-500 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition shadow-md"
            >
              취소
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="text-green-600" />
              통계
            </h2>
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={generateReport}
                className="px-4 py-2 rounded-lg font-medium transition bg-green-600 text-white hover:bg-green-700"
              >
                📋 리포트 복사
              </button>
              <button
                onClick={() => setViewMode('recent')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  viewMode === 'recent'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                최근
              </button>
              <button
                onClick={() => setViewMode('custom')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  viewMode === 'custom'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                기간 선택
              </button>
            </div>
          </div>

          {viewMode === 'recent' ? (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setViewPeriod('2weeks')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  viewPeriod === '2weeks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                최근 2주
              </button>
              <button
                onClick={() => setViewPeriod('4weeks')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  viewPeriod === '4weeks'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                최근 4주
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작일
                </label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({...customDateRange, start: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료일
                </label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({...customDateRange, end: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium mb-1">총 근무시간</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalHours.toFixed(1)}h</p>
              <p className="text-xs text-blue-600 mt-1">
                일반: {stats.regularHours.toFixed(1)}h | 홀리데이: {stats.holidayHours.toFixed(1)}h
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg">
              <p className="text-sm text-gray-600 font-medium mb-1">총 급여</p>
              <p className="text-2xl font-bold text-gray-900">${stats.totalGrossPay.toFixed(2)}</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg">
              <p className="text-sm text-red-600 font-medium mb-1">총 공제</p>
              <p className="text-2xl font-bold text-red-900">-${stats.totalDeductions.toFixed(2)}</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium mb-1">실수령액</p>
              <p className="text-2xl font-bold text-green-900">${stats.totalNetPay.toFixed(2)}</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium mb-1">팁</p>
              <p className="text-2xl font-bold text-purple-900">${stats.totalTips.toFixed(2)}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
              <p className="text-sm text-orange-600 font-medium mb-1">총 수입</p>
              <p className="text-2xl font-bold text-orange-900">
                ${(stats.totalNetPay + stats.totalTips).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">근무 기록</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {getFilteredEntries().map((entry) => (
              <div
                key={entry.id}
                className={`p-4 rounded-lg border-l-4 ${
                  entry.is_holiday ? 'border-orange-500 bg-orange-50' : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800">{entry.date}</span>
                      {entry.is_holiday && (
                        <span className="px-2 py-1 bg-orange-200 text-orange-800 text-xs font-medium rounded">
                          홀리데이
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">시간: </span>
                        <span className="font-medium">{entry.hours}h</span>
                      </div>
                      <div>
                        <span className="text-gray-600">총 급여: </span>
                        <span className="font-medium text-gray-700">${(entry.gross_pay || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">공제: </span>
                        <span className="font-medium text-red-700">-${(entry.deductions || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">실수령: </span>
                        <span className="font-medium text-green-700">${(entry.net_pay || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">팁: </span>
                        <span className="font-medium text-purple-700">${(entry.tips || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => editEntry(entry)}
                      className="px-3 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition text-sm font-medium"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-sm font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {getFilteredEntries().length === 0 && (
              <p className="text-center text-gray-500 py-8">아직 기록이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}