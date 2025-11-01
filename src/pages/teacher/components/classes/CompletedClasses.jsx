// src/pages/teacher/components/classes/CompletedClassesTab.jsx
import React, { useState, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight, Calendar, Clock, User } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";

export default function CompletedClassesTab({ classes, teacherInfo }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const itemsPerPage = 10;

  // Filter classes based on search and date range
  const filteredClasses = useMemo(() => {
    let filtered = classes;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((cls) =>
        cls.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cls.students.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date

      filtered = filtered.filter((cls) => {
        const classDate = new Date(cls.scheduledTime);
        return classDate >= start && classDate <= end;
      });
    }

    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [classes, searchQuery, startDate, endDate]);

  // Pagination
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClasses = filteredClasses.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  // Generate PDF
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text("Completed Classes Report", 14, 20);
    
    // Add teacher info
    doc.setFontSize(11);
    doc.text(`Teacher: ${teacherInfo.firstName} ${teacherInfo.lastName}`, 14, 30);
    doc.text(`Email: ${teacherInfo.email}`, 14, 36);
    
    // Add date range if applicable
    if (startDate && endDate) {
      doc.text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 14, 42);
    } else {
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
    }
    
    doc.text(`Total Classes: ${filteredClasses.length}`, 14, 48);

    // Prepare table data
    const tableData = filteredClasses.map((cls, index) => [
      index + 1,
      cls.title,
      cls.topic,
      cls.students.join(", "),
      cls.fullDateTime,
      `${cls.duration} mins`
    ]);

    // Add table
    doc.autoTable({
      startY: 55,
      head: [['#', 'Class Title', 'Topic', 'Student(s)', 'Date & Time', 'Duration']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234] }, // Purple
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 40 },
        5: { cellWidth: 20 }
      }
    });

    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    // Save PDF
    const filename = startDate && endDate
      ? `completed-classes-${startDate}-to-${endDate}.pdf`
      : `completed-classes-${new Date().toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Completed Classes</h2>
        
        {/* Search and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search classes, topics, or students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredClasses.length)} of {filteredClasses.length} classes
          </div>
          
          <button
            onClick={generatePDF}
            disabled={filteredClasses.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Classes List */}
      {currentClasses.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500 text-lg">
            {searchQuery || startDate || endDate
              ? "No classes found matching your criteria"
              : "No completed classes yet"}
          </p>
          {(searchQuery || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStartDate("");
                setEndDate("");
              }}
              className="mt-4 px-4 py-2 text-purple-600 hover:text-purple-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md divide-y divide-gray-200">
          {currentClasses.map((cls, index) => (
            <div key={cls.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 text-purple-600 rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                      {startIndex + index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{cls.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Topic:</span> {cls.topic}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{cls.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{cls.time} ({cls.duration} mins)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{cls.students.join(", ")}</span>
                        </div>
                      </div>
                      
                      {cls.notes && (
                        <p className="text-sm text-gray-500 mt-2">
                          <span className="font-medium">Notes:</span> {cls.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                    Completed
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                        currentPage === page
                          ? "bg-purple-600 text-white"
                          : "bg-white border hover:bg-gray-50"
                      }`}
                    >
                      {page}
                    </button>
                  );
                }
                // Show ellipsis
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <span key={page} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
