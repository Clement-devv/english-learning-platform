// src/pages/teacher/components/classes/CompletedClasses.jsx
import React, { useState, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight, Calendar, Clock, User, AlertCircle } from "lucide-react";

export default function CompletedClassesTab({ classes, teacherInfo, isDarkMode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportError, setExportError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
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
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter((cls) => {
        const classDate = new Date(cls.scheduledTime);
        return classDate >= start && classDate <= end;
      });
    }

    return filtered.sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));
  }, [classes, searchQuery, startDate, endDate]);

  // Pagination
  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentClasses = filteredClasses.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDate, endDate]);

  // Generate PDF using dynamic import
  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      setExportError("");

      // Validation
      if (!teacherInfo) {
        setExportError("Teacher information not available");
        setIsGenerating(false);
        return;
      }

      if (filteredClasses.length === 0) {
        setExportError("No classes to export");
        setIsGenerating(false);
        return;
      }

      console.log("📄 Starting PDF generation...");

      // Dynamic import to ensure proper loading
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      console.log("✅ jsPDF loaded");

      const doc = new jsPDF();

      // Verify autoTable is available
      if (typeof doc.autoTable !== 'function') {
        console.error("❌ autoTable not attached to jsPDF instance");
        
        // Try alternative: load autoTable manually
        try {
          const autoTable = await import('jspdf-autotable');
          console.log("📦 Loaded autoTable module:", autoTable);
          
          if (autoTable.default) {
            console.log("🔧 Attempting to use default export");
          }
        } catch (err) {
          console.error("Failed to load autoTable:", err);
        }
        
        setExportError("PDF library loading error. Please try refreshing the page.");
        setIsGenerating(false);
        return;
      }

      console.log("✅ autoTable function available");

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(147, 51, 234);
      doc.text("Completed Classes Report", 14, 20);

      // Add teacher info
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Teacher: ${teacherInfo.firstName} ${teacherInfo.lastName}`, 14, 30);
      doc.text(`Email: ${teacherInfo.email}`, 14, 36);

      if (startDate && endDate) {
        doc.text(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 14, 42);
      } else {
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 42);
      }

      doc.text(`Total Classes: ${filteredClasses.length}`, 14, 48);

      // Prepare table data
      const tableData = filteredClasses.map((cls, index) => [
        index + 1,
        cls.title || 'N/A',
        cls.topic || 'N/A',
        cls.students.join(", ") || 'N/A',
        cls.fullDateTime || new Date(cls.scheduledTime).toLocaleString(),
        `${cls.duration || 0} min`
      ]);

      console.log("📊 Table data prepared:", tableData.length, "rows");

      // Add table
      doc.autoTable({
        startY: 55,
        head: [['#', 'Class Title', 'Topic', 'Student(s)', 'Date & Time', 'Duration']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [147, 51, 234],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 40 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 40 },
          5: { cellWidth: 20, halign: 'center' }
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        }
      });

      console.log("✅ Table added to PDF");

      // Add footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
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

      console.log(`✅ PDF saved successfully: ${filename}`);
      setIsGenerating(false);

    } catch (error) {
      console.error("❌ PDF generation failed:", error);
      console.error("Error stack:", error.stack);
      setExportError(`Failed to generate PDF: ${error.message}`);
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className={`${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } rounded-2xl border shadow-lg p-6`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className={`text-2xl font-bold mb-2 ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Completed Classes
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Review your teaching history and export reports
            </p>
          </div>
          <button
            onClick={generatePDF}
            disabled={filteredClasses.length === 0 || isGenerating}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl ${
              filteredClasses.length === 0 || isGenerating
                ? isDarkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isDarkMode
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
            }`}
          >
            <Download className={`w-5 h-5 ${isGenerating ? 'animate-bounce' : ''}`} />
            {isGenerating ? 'Generating...' : 'Export PDF'}
          </button>
        </div>

        {/* Export Error */}
        {exportError && (
          <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            isDarkMode ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-700'
          } border`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1">{exportError}</p>
              <button
                onClick={() => setExportError("")}
                className="text-xs underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search classes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg transition-all ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-purple-500'
              } border-2 focus:ring-2 focus:ring-purple-500/50 outline-none`}
            />
          </div>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`px-4 py-3 rounded-lg transition-all ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white focus:border-purple-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
            } border-2 focus:ring-2 focus:ring-purple-500/50 outline-none`}
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`px-4 py-3 rounded-lg transition-all ${
              isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white focus:border-purple-500'
                : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'
            } border-2 focus:ring-2 focus:ring-purple-500/50 outline-none`}
          />
        </div>

        <div className={`mt-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Showing <span className="font-semibold">{startIndex + 1}-{Math.min(endIndex, filteredClasses.length)}</span> of <span className="font-semibold">{filteredClasses.length}</span> classes
        </div>
      </div>

      {/* Classes List */}
      {currentClasses.length === 0 ? (
        <div className={`${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } rounded-2xl border shadow-lg p-12 text-center`}>
          <Calendar className={`w-16 h-16 mx-auto mb-4 ${
            isDarkMode ? 'text-gray-600' : 'text-gray-300'
          }`} />
          <p className={`text-lg font-semibold mb-2 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
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
              className={`mt-4 px-6 py-3 rounded-lg font-semibold transition-all ${
                isDarkMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {currentClasses.map((cls) => (
            <div
              key={cls.id}
              className={`${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                  : 'bg-white border-gray-200 hover:shadow-xl'
              } rounded-2xl border shadow-lg transition-all duration-300 overflow-hidden`}
            >
              <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500"></div>

              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold mb-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {cls.title}
                    </h3>
                    <p className={`text-sm mb-4 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {cls.topic}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`${
                          isDarkMode ? 'bg-purple-900/30' : 'bg-purple-100'
                        } p-2 rounded-lg`}>
                          <Calendar className={`w-5 h-5 ${
                            isDarkMode ? 'text-purple-400' : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Date
                          </p>
                          <p className={`text-sm font-semibold ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {cls.fullDateTime || new Date(cls.scheduledTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`${
                          isDarkMode ? 'bg-blue-900/30' : 'bg-blue-100'
                        } p-2 rounded-lg`}>
                          <Clock className={`w-5 h-5 ${
                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Duration
                          </p>
                          <p className={`text-sm font-semibold ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {cls.duration} minutes
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`${
                          isDarkMode ? 'bg-green-900/30' : 'bg-green-100'
                        } p-2 rounded-lg`}>
                          <User className={`w-5 h-5 ${
                            isDarkMode ? 'text-green-400' : 'text-green-600'
                          }`} />
                        </div>
                        <div>
                          <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                            Students
                          </p>
                          <p className={`text-sm font-semibold ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {cls.students.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {cls.students.map((student, idx) => (
                        <span
                          key={idx}
                          className={`${
                            isDarkMode
                              ? 'bg-gray-700 text-gray-300 border-gray-600'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          } px-3 py-1.5 rounded-lg text-sm font-medium border`}
                        >
                          {student}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={`${
                    isDarkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                  } px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 self-start lg:self-center`}>
                    <div className="w-2 h-2 bg-current rounded-full"></div>
                    Completed
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } rounded-2xl border shadow-lg p-4`}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                currentPage === 1
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index + 1)}
                  className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                    currentPage === index + 1
                      ? isDarkMode
                        ? 'bg-purple-600 text-white'
                        : 'bg-purple-600 text-white'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                currentPage === totalPages
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDarkMode
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
