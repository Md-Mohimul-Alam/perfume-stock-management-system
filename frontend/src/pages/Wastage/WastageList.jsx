import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  Calendar,
  Eye,
  Pencil,
  Search,
  Trash2,
  X,
  Save,
  Loader2,
  RotateCcw,
} from 'lucide-react';

import toast from 'react-hot-toast';

import API from '../../api/axios';

/* ========================================
   HELPERS
======================================== */

const toNumber = (
  value
) => {
  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
};

const money = (
  value
) =>
  `৳${toNumber(
    value
  ).toFixed(2)}`;

const formatDate = (
  value
) => {
  if (!value) {
    return '-';
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '-';
  }

  return date.toLocaleDateString(
    'en-US'
  );
};

const toDateInputValue = (
  value
) => {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  return `${year}-${month}-${day}`;
};

/* ========================================
   NORMALIZE OLD FLOATING-POINT TEXT

   Example:
   3.8799999999999955 ml
   →
   3.88 ml
======================================== */

const cleanWastageDescription = (
  description
) => {
  if (
    !description ||
    typeof description !==
      'string'
  ) {
    return description || '';
  }

  return description.replace(
    /(-?\d+\.\d{3,})\s*ml/gi,
    (
      match,
      value
    ) => {
      const parsed =
        Number(
          value
        );

      if (
        !Number.isFinite(
          parsed
        )
      ) {
        return match;
      }

      return `${parsed.toFixed(
        2
      )} ml`;
    }
  );
};

/* ========================================
   COMPONENT
======================================== */

const WastageList =
  () => {
    const [
      wastages,
      setWastages,
    ] = useState(
      []
    );

    const [
      loading,
      setLoading,
    ] = useState(
      true
    );

    const [
      search,
      setSearch,
    ] = useState(
      ''
    );

    const [
      dateRange,
      setDateRange,
    ] = useState({
      start: '',
      end: '',
    });

    /* ======================================
       DETAILS MODAL
    ====================================== */

    const [
      selectedWastage,
      setSelectedWastage,
    ] = useState(
      null
    );

    const [
      showDetails,
      setShowDetails,
    ] = useState(
      false
    );

    /* ======================================
       EDIT MODAL
    ====================================== */

    const [
      showEdit,
      setShowEdit,
    ] = useState(
      false
    );

    const [
      editingWastage,
      setEditingWastage,
    ] = useState(
      null
    );

    const [
      saving,
      setSaving,
    ] = useState(
      false
    );

    const [
      editForm,
      setEditForm,
    ] = useState({
      date: '',
      description: '',
      reference: '',
      amount: '',
      notes: '',
    });

    /* ======================================
       FETCH
    ====================================== */

    const fetchWastages =
      async () => {
        setLoading(
          true
        );

        try {
          const {
            data,
          } =
            await API.get(
              '/expenses'
            );

          const rows =
            Array.isArray(
              data
            )
              ? data
              : [];

          const wastageData =
            rows.filter(
              (
                expense
              ) =>
                expense
                  .category ===
                'Wastage'
            );

          setWastages(
            wastageData
          );
        } catch (
          error
        ) {
          console.error(
            'Load wastage error:',
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              'Failed to load wastage records'
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    useEffect(() => {
      fetchWastages();
    }, []);

    /* ======================================
       FILTERING
    ====================================== */

    const filtered =
      useMemo(
        () => {
          const query =
            search
              .trim()
              .toLowerCase();

          return wastages.filter(
            (
              wastage
            ) => {
              const description =
                String(
                  wastage.description ||
                    ''
                ).toLowerCase();

              const reference =
                String(
                  wastage.reference ||
                    ''
                ).toLowerCase();

              const notes =
                String(
                  wastage.notes ||
                    ''
                ).toLowerCase();

              const matchesSearch =
                !query ||
                description.includes(
                  query
                ) ||
                reference.includes(
                  query
                ) ||
                notes.includes(
                  query
                );

              let matchesDate =
                true;

              const wastageDate =
                new Date(
                  wastage.date
                );

              if (
                dateRange.start
              ) {
                const start =
                  new Date(
                    `${dateRange.start}T00:00:00`
                  );

                if (
                  wastageDate <
                  start
                ) {
                  matchesDate =
                    false;
                }
              }

              if (
                dateRange.end
              ) {
                const end =
                  new Date(
                    `${dateRange.end}T23:59:59.999`
                  );

                if (
                  wastageDate >
                  end
                ) {
                  matchesDate =
                    false;
                }
              }

              return (
                matchesSearch &&
                matchesDate
              );
            }
          );
        },
        [
          wastages,
          search,
          dateRange,
        ]
      );

    const totalAmount =
      useMemo(
        () =>
          filtered.reduce(
            (
              sum,
              wastage
            ) =>
              sum +
              toNumber(
                wastage.amount
              ),
            0
          ),
        [
          filtered,
        ]
      );

    /* ======================================
       DETAILS
    ====================================== */

    const openDetails =
      (
        wastage
      ) => {
        setSelectedWastage(
          wastage
        );

        setShowDetails(
          true
        );
      };

    const closeDetails =
      () => {
        setShowDetails(
          false
        );

        setSelectedWastage(
          null
        );
      };

    /* ======================================
       EDIT
    ====================================== */

    const openEdit =
      (
        wastage
      ) => {
        setEditingWastage(
          wastage
        );

        setEditForm({
          date:
            toDateInputValue(
              wastage.date
            ),

          description:
            cleanWastageDescription(
              wastage.description ||
                ''
            ),

          reference:
            wastage.reference ||
            '',

          amount:
            String(
              toNumber(
                wastage.amount
              )
            ),

          notes:
            wastage.notes ||
            '',
        });

        setShowEdit(
          true
        );
      };

    const closeEdit =
      () => {
        if (
          saving
        ) {
          return;
        }

        setShowEdit(
          false
        );

        setEditingWastage(
          null
        );

        setEditForm({
          date: '',
          description: '',
          reference: '',
          amount: '',
          notes: '',
        });
      };

    const handleEditChange =
      (
        event
      ) => {
        const {
          name,
          value,
        } =
          event.target;

        setEditForm(
          (
            previous
          ) => ({
            ...previous,

            [name]:
              value,
          })
        );
      };

    const handleSaveEdit =
      async (
        event
      ) => {
        event.preventDefault();

        if (
          !editingWastage
            ?._id
        ) {
          return;
        }

        const amount =
          Number(
            editForm.amount
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <
            0
        ) {
          toast.error(
            'Enter a valid wastage amount'
          );

          return;
        }

        if (
          !editForm.date
        ) {
          toast.error(
            'Select a date'
          );

          return;
        }

        if (
          !editForm.description
            .trim()
        ) {
          toast.error(
            'Description is required'
          );

          return;
        }

        setSaving(
          true
        );

        try {
          const payload = {
            type:
              'regular',

            category:
              'Wastage',

            amount,

            date:
              editForm.date,

            description:
              editForm.description
                .trim(),

            reference:
              editForm.reference
                .trim(),

            notes:
              editForm.notes
                .trim(),
          };

          const {
            data,
          } =
            await API.put(
              `/expenses/${editingWastage._id}`,
              payload
            );

          setWastages(
            (
              previous
            ) =>
              previous.map(
                (
                  item
                ) =>
                  item._id ===
                  editingWastage._id
                    ? data
                    : item
              )
          );

          toast.success(
            'Wastage updated successfully'
          );

          setShowEdit(
            false
          );

          setEditingWastage(
            null
          );
        } catch (
          error
        ) {
          console.error(
            'Update wastage error:',
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              'Failed to update wastage'
          );
        } finally {
          setSaving(
            false
          );
        }
      };

    /* ======================================
       DELETE
    ====================================== */

    const handleDelete =
      async (
        id
      ) => {
        const confirmed =
          window.confirm(
            'Delete this wastage history record? This removes the expense record and its linked cash transaction.'
          );

        if (
          !confirmed
        ) {
          return;
        }

        try {
          await API.delete(
            `/expenses/${id}`
          );

          setWastages(
            (
              previous
            ) =>
              previous.filter(
                (
                  item
                ) =>
                  item._id !==
                  id
              )
          );

          toast.success(
            'Wastage deleted'
          );
        } catch (
          error
        ) {
          console.error(
            'Delete wastage error:',
            error
          );

          toast.error(
            error.response
              ?.data
              ?.message ||
              'Delete failed'
          );
        }
      };

    /* ======================================
       CLEAR FILTERS
    ====================================== */

    const clearFilters =
      () => {
        setSearch(
          ''
        );

        setDateRange({
          start: '',
          end: '',
        });
      };

    /* ======================================
       UI
    ====================================== */

    return (
      <div
        className="
          mx-auto
          w-full
          max-w-7xl
          px-0
          py-2

          sm:py-4
        "
      >
        {/* ==================================
            HEADER
        ================================== */}

        <div
          className="
            mb-6

            flex
            flex-col

            gap-4

            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>

            <h1
              className="
                text-2xl
                font-bold

                text-gray-900

                dark:text-white

                sm:text-3xl
              "
            >
              Wastage History
            </h1>

            <p
              className="
                mt-1

                text-sm

                text-gray-500

                dark:text-gray-400
              "
            >
              View, edit and manage all recorded wastage expenses
            </p>

          </div>

          <Link
            to="/wastage/new"
            className="
              inline-flex
              min-h-[44px]
              items-center
              justify-center
              gap-2

              rounded-xl

              bg-red-600

              px-4
              py-2.5

              text-sm
              font-semibold

              text-white

              shadow-sm

              transition

              hover:bg-red-700

              active:scale-[0.98]
            "
          >
            <span
              className="
                text-lg
                leading-none
              "
            >
              +
            </span>

            Record Wastage
          </Link>
        </div>

        {/* ==================================
            SUMMARY
        ================================== */}

        <div
          className="
            mb-6

            rounded-2xl

            border
            border-gray-200

            bg-white

            p-4

            shadow-sm

            dark:border-slate-700
            dark:bg-slate-800

            sm:p-5
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-4
            "
          >
            <div>

              <p
                className="
                  text-sm
                  font-medium

                  text-gray-500

                  dark:text-gray-400
                "
              >
                Total Wastage
              </p>

              <p
                className="
                  mt-1

                  text-xs

                  text-gray-400

                  dark:text-gray-500
                "
              >
                {
                  filtered.length
                }{' '}
                record
                {filtered.length ===
                1
                  ? ''
                  : 's'}
              </p>

            </div>

            <span
              className="
                text-2xl
                font-bold

                text-red-600

                dark:text-red-400

                sm:text-3xl
              "
            >
              {money(
                totalAmount
              )}
            </span>

          </div>
        </div>

        {/* ==================================
            FILTERS
        ================================== */}

        <div
          className="
            mb-6

            grid
            grid-cols-1

            gap-4

            rounded-2xl

            border
            border-gray-200

            bg-white

            p-4

            shadow-sm

            dark:border-slate-700
            dark:bg-slate-800

            md:grid-cols-12
          "
        >
          {/* Search */}

          <div
            className="
              md:col-span-5
            "
          >
            <label
              className="
                mb-1.5
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              Search
            </label>

            <div
              className="
                relative
              "
            >
              <Search
                size={
                  18
                }
                className="
                  absolute
                  left-3
                  top-1/2

                  -translate-y-1/2

                  text-gray-400
                "
              />

              <input
                type="search"
                placeholder="Description, reference or notes"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                className="
                  w-full

                  rounded-xl

                  border
                  border-gray-300

                  bg-white

                  py-2.5
                  pl-10
                  pr-4

                  text-[16px]
                  text-gray-900

                  outline-none

                  transition

                  focus:border-red-500
                  focus:ring-2
                  focus:ring-red-500/20

                  dark:border-slate-600
                  dark:bg-slate-900
                  dark:text-white
                "
              />
            </div>
          </div>

          {/* From */}

          <div
            className="
              md:col-span-3
            "
          >
            <label
              className="
                mb-1.5
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              From
            </label>

            <div className="relative">

              <Calendar
                size={
                  17
                }
                className="
                  pointer-events-none

                  absolute
                  left-3
                  top-1/2

                  -translate-y-1/2

                  text-gray-400
                "
              />

              <input
                type="date"
                value={
                  dateRange.start
                }
                onChange={(
                  event
                ) =>
                  setDateRange(
                    (
                      previous
                    ) => ({
                      ...previous,

                      start:
                        event
                          .target
                          .value,
                    })
                  )
                }
                className="
                  w-full

                  rounded-xl

                  border
                  border-gray-300

                  bg-white

                  py-2.5
                  pl-10
                  pr-3

                  text-[16px]
                  text-gray-900

                  outline-none

                  focus:border-red-500
                  focus:ring-2
                  focus:ring-red-500/20

                  dark:border-slate-600
                  dark:bg-slate-900
                  dark:text-white
                "
              />

            </div>
          </div>

          {/* To */}

          <div
            className="
              md:col-span-3
            "
          >
            <label
              className="
                mb-1.5
                block

                text-sm
                font-medium

                text-gray-700

                dark:text-gray-300
              "
            >
              To
            </label>

            <input
              type="date"
              value={
                dateRange.end
              }
              onChange={(
                event
              ) =>
                setDateRange(
                  (
                    previous
                  ) => ({
                    ...previous,

                    end:
                      event
                        .target
                        .value,
                  })
                )
              }
              className="
                w-full

                rounded-xl

                border
                border-gray-300

                bg-white

                px-3
                py-2.5

                text-[16px]
                text-gray-900

                outline-none

                focus:border-red-500
                focus:ring-2
                focus:ring-red-500/20

                dark:border-slate-600
                dark:bg-slate-900
                dark:text-white
              "
            />
          </div>

          {/* Clear */}

          <div
            className="
              flex
              items-end

              md:col-span-1
            "
          >
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="
                flex
                min-h-[44px]
                w-full
                items-center
                justify-center

                rounded-xl

                border
                border-gray-300

                text-gray-600

                transition

                hover:bg-gray-50

                dark:border-slate-600
                dark:text-gray-300
                dark:hover:bg-slate-700
              "
              title="Clear filters"
            >
              <RotateCcw
                size={
                  17
                }
              />
            </button>
          </div>
        </div>

        {/* ==================================
            CONTENT
        ================================== */}

        {loading ? (
          <div
            className="
              flex
              min-h-[300px]
              items-center
              justify-center

              rounded-2xl

              border
              border-gray-200

              bg-white

              dark:border-slate-700
              dark:bg-slate-800
            "
          >
            <div
              className="
                flex
                flex-col
                items-center
                gap-3
              "
            >
              <Loader2
                size={
                  38
                }
                className="
                  animate-spin
                  text-red-500
                "
              />

              <p
                className="
                  text-sm
                  text-gray-500

                  dark:text-gray-400
                "
              >
                Loading wastage records...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ==================================
                MOBILE CARDS
            ================================== */}

            <div
              className="
                space-y-3

                md:hidden
              "
            >
              {filtered.map(
                (
                  wastage
                ) => (
                  <article
                    key={
                      wastage._id
                    }
                    className="
                      rounded-2xl

                      border
                      border-gray-200

                      bg-white

                      p-4

                      shadow-sm

                      dark:border-slate-700
                      dark:bg-slate-800
                    "
                  >
                    <div
                      className="
                        flex
                        items-start
                        justify-between
                        gap-3
                      "
                    >
                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
                        <p
                          className="
                            text-xs
                            font-medium

                            text-gray-400

                            dark:text-gray-500
                          "
                        >
                          {formatDate(
                            wastage.date
                          )}
                        </p>

                        <h3
                          className="
                            mt-1

                            break-words

                            text-sm
                            font-semibold

                            text-gray-800

                            dark:text-gray-100
                          "
                        >
                          {cleanWastageDescription(
                            wastage.description
                          ) ||
                            '-'}
                        </h3>

                        <p
                          className="
                            mt-2

                            text-xs

                            text-gray-500

                            dark:text-gray-400
                          "
                        >
                          Reference:{' '}

                          <span
                            className="
                              font-medium
                            "
                          >
                            {wastage.reference ||
                              '-'}
                          </span>
                        </p>
                      </div>

                      <p
                        className="
                          flex-shrink-0

                          text-base
                          font-bold

                          text-red-600

                          dark:text-red-400
                        "
                      >
                        {money(
                          wastage.amount
                        )}
                      </p>
                    </div>

                    <div
                      className="
                        mt-4

                        flex
                        items-center
                        justify-end

                        gap-2

                        border-t
                        border-gray-100

                        pt-3

                        dark:border-slate-700
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          openDetails(
                            wastage
                          )
                        }
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center

                          rounded-xl

                          bg-blue-50

                          text-blue-600

                          transition

                          hover:bg-blue-100

                          dark:bg-blue-500/10
                          dark:text-blue-400
                        "
                        title="View details"
                      >
                        <Eye
                          size={
                            18
                          }
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            wastage
                          )
                        }
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center

                          rounded-xl

                          bg-amber-50

                          text-amber-600

                          transition

                          hover:bg-amber-100

                          dark:bg-amber-500/10
                          dark:text-amber-400
                        "
                        title="Edit wastage"
                      >
                        <Pencil
                          size={
                            18
                          }
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            wastage._id
                          )
                        }
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center

                          rounded-xl

                          bg-red-50

                          text-red-600

                          transition

                          hover:bg-red-100

                          dark:bg-red-500/10
                          dark:text-red-400
                        "
                        title="Delete wastage"
                      >
                        <Trash2
                          size={
                            18
                          }
                        />
                      </button>
                    </div>
                  </article>
                )
              )}

              {filtered.length ===
                0 && (
                <div
                  className="
                    rounded-2xl

                    border
                    border-gray-200

                    bg-white

                    py-12

                    text-center

                    text-sm
                    text-gray-400

                    dark:border-slate-700
                    dark:bg-slate-800
                    dark:text-gray-500
                  "
                >
                  No wastage records found
                </div>
              )}
            </div>

            {/* ==================================
                DESKTOP TABLE
            ================================== */}

            <div
              className="
                hidden
                overflow-hidden

                rounded-2xl

                border
                border-gray-200

                bg-white

                shadow-sm

                dark:border-slate-700
                dark:bg-slate-800

                md:block
              "
            >
              <div
                className="
                  overflow-x-auto
                "
              >
                <table
                  className="
                    w-full
                    min-w-[900px]

                    divide-y
                    divide-gray-200

                    dark:divide-slate-700
                  "
                >
                  <thead
                    className="
                      bg-gray-50

                      dark:bg-slate-900/60
                    "
                  >
                    <tr>

                      <th
                        className="
                          px-5
                          py-3.5

                          text-left

                          text-xs
                          font-semibold
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Date
                      </th>

                      <th
                        className="
                          px-5
                          py-3.5

                          text-left

                          text-xs
                          font-semibold
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Description
                      </th>

                      <th
                        className="
                          px-5
                          py-3.5

                          text-left

                          text-xs
                          font-semibold
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Reference
                      </th>

                      <th
                        className="
                          px-5
                          py-3.5

                          text-right

                          text-xs
                          font-semibold
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Amount
                      </th>

                      <th
                        className="
                          px-5
                          py-3.5

                          text-center

                          text-xs
                          font-semibold
                          uppercase
                          tracking-wider

                          text-gray-500

                          dark:text-gray-400
                        "
                      >
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody
                    className="
                      divide-y
                      divide-gray-200

                      dark:divide-slate-700
                    "
                  >
                    {filtered.map(
                      (
                        wastage
                      ) => (
                        <tr
                          key={
                            wastage._id
                          }
                          className="
                            transition-colors

                            hover:bg-gray-50

                            dark:hover:bg-slate-700/40
                          "
                        >
                          <td
                            className="
                              whitespace-nowrap

                              px-5
                              py-4

                              text-sm

                              text-gray-600

                              dark:text-gray-300
                            "
                          >
                            {formatDate(
                              wastage.date
                            )}
                          </td>

                          <td
                            className="
                              max-w-[480px]

                              px-5
                              py-4

                              text-sm

                              text-gray-800

                              dark:text-gray-200
                            "
                          >
                            {cleanWastageDescription(
                              wastage.description
                            ) ||
                              '-'}
                          </td>

                          <td
                            className="
                              whitespace-nowrap

                              px-5
                              py-4

                              text-sm
                              font-medium

                              text-gray-600

                              dark:text-gray-300
                            "
                          >
                            {wastage.reference ||
                              '-'}
                          </td>

                          <td
                            className="
                              whitespace-nowrap

                              px-5
                              py-4

                              text-right
                              text-sm
                              font-bold

                              text-red-600

                              dark:text-red-400
                            "
                          >
                            {money(
                              wastage.amount
                            )}
                          </td>

                          <td
                            className="
                              whitespace-nowrap

                              px-5
                              py-4

                              text-center
                            "
                          >
                            <div
                              className="
                                flex
                                items-center
                                justify-center
                                gap-2
                              "
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  openDetails(
                                    wastage
                                  )
                                }
                                className="
                                  flex
                                  h-9
                                  w-9
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-blue-600

                                  transition

                                  hover:bg-blue-50

                                  dark:text-blue-400
                                  dark:hover:bg-blue-500/10
                                "
                                title="View Details"
                              >
                                <Eye
                                  size={
                                    18
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openEdit(
                                    wastage
                                  )
                                }
                                className="
                                  flex
                                  h-9
                                  w-9
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-amber-600

                                  transition

                                  hover:bg-amber-50

                                  dark:text-amber-400
                                  dark:hover:bg-amber-500/10
                                "
                                title="Edit"
                              >
                                <Pencil
                                  size={
                                    18
                                  }
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    wastage._id
                                  )
                                }
                                className="
                                  flex
                                  h-9
                                  w-9
                                  items-center
                                  justify-center

                                  rounded-lg

                                  text-red-600

                                  transition

                                  hover:bg-red-50

                                  dark:text-red-400
                                  dark:hover:bg-red-500/10
                                "
                                title="Delete"
                              >
                                <Trash2
                                  size={
                                    18
                                  }
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}

                    {filtered.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={
                            5
                          }
                          className="
                            py-12

                            text-center

                            text-sm

                            text-gray-400

                            dark:text-gray-500
                          "
                        >
                          No wastage records found
                        </td>
                      </tr>
                    )}
                  </tbody>

                  <tfoot
                    className="
                      bg-gray-50

                      font-semibold

                      dark:bg-slate-900/60
                    "
                  >
                    <tr>

                      <td
                        colSpan={
                          3
                        }
                        className="
                          px-5
                          py-4

                          text-right

                          text-sm

                          text-gray-700

                          dark:text-gray-300
                        "
                      >
                        Total
                      </td>

                      <td
                        className="
                          px-5
                          py-4

                          text-right

                          text-base
                          font-bold

                          text-red-600

                          dark:text-red-400
                        "
                      >
                        {money(
                          totalAmount
                        )}
                      </td>

                      <td />

                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ==================================
            DETAILS MODAL
        ================================== */}

        {showDetails &&
          selectedWastage && (
          <div
            className="
              fixed
              inset-0
              z-50

              flex
              items-end
              justify-center

              bg-black/60

              p-0

              backdrop-blur-sm

              sm:items-center
              sm:p-4
            "
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeDetails();
              }
            }}
          >
            <div
              className="
                safe-bottom

                relative

                max-h-[92dvh]
                w-full

                overflow-y-auto

                rounded-t-3xl

                bg-white

                p-5

                shadow-2xl

                dark:bg-slate-800

                sm:max-w-lg
                sm:rounded-2xl
                sm:p-6
              "
            >
              <button
                type="button"
                onClick={
                  closeDetails
                }
                className="
                  absolute
                  right-4
                  top-4

                  flex
                  h-9
                  w-9
                  items-center
                  justify-center

                  rounded-xl

                  text-gray-400

                  transition

                  hover:bg-gray-100
                  hover:text-gray-700

                  dark:hover:bg-slate-700
                  dark:hover:text-white
                "
              >
                <X
                  size={
                    21
                  }
                />
              </button>

              <h2
                className="
                  pr-12

                  text-xl
                  font-bold

                  text-gray-900

                  dark:text-white
                "
              >
                Wastage Details
              </h2>

              <div
                className="
                  mt-6

                  space-y-4
                "
              >
                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-wider

                      text-gray-400
                    "
                  >
                    Date
                  </p>

                  <p
                    className="
                      mt-1

                      font-medium

                      text-gray-800

                      dark:text-gray-200
                    "
                  >
                    {formatDate(
                      selectedWastage.date
                    )}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-wider

                      text-gray-400
                    "
                  >
                    Amount
                  </p>

                  <p
                    className="
                      mt-1

                      text-2xl
                      font-bold

                      text-red-600

                      dark:text-red-400
                    "
                  >
                    {money(
                      selectedWastage.amount
                    )}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-wider

                      text-gray-400
                    "
                  >
                    Description
                  </p>

                  <p
                    className="
                      mt-1

                      break-words

                      font-medium

                      text-gray-800

                      dark:text-gray-200
                    "
                  >
                    {cleanWastageDescription(
                      selectedWastage.description
                    ) ||
                      '-'}
                  </p>
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-wider

                      text-gray-400
                    "
                  >
                    Reference
                  </p>

                  <p
                    className="
                      mt-1

                      font-medium

                      text-gray-800

                      dark:text-gray-200
                    "
                  >
                    {selectedWastage.reference ||
                      '-'}
                  </p>
                </div>

                {selectedWastage.notes && (
                  <div>
                    <p
                      className="
                        text-xs
                        uppercase
                        tracking-wider

                        text-gray-400
                      "
                    >
                      Notes
                    </p>

                    <p
                      className="
                        mt-1

                        whitespace-pre-wrap

                        font-medium

                        text-gray-800

                        dark:text-gray-200
                      "
                    >
                      {
                        selectedWastage.notes
                      }
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  const record =
                    selectedWastage;

                  closeDetails();

                  openEdit(
                    record
                  );
                }}
                className="
                  mt-6

                  flex
                  min-h-[46px]
                  w-full
                  items-center
                  justify-center
                  gap-2

                  rounded-xl

                  bg-amber-500

                  px-4

                  font-semibold

                  text-white

                  transition

                  hover:bg-amber-600
                "
              >
                <Pencil
                  size={
                    17
                  }
                />

                Edit Wastage
              </button>
            </div>
          </div>
        )}

        {/* ==================================
            EDIT MODAL
        ================================== */}

        {showEdit &&
          editingWastage && (
          <div
            className="
              fixed
              inset-0
              z-[60]

              flex
              items-end
              justify-center

              bg-black/60

              p-0

              backdrop-blur-sm

              sm:items-center
              sm:p-4
            "
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeEdit();
              }
            }}
          >
            <div
              className="
                safe-bottom

                relative

                max-h-[94dvh]
                w-full

                overflow-y-auto

                rounded-t-3xl

                bg-white

                p-5

                shadow-2xl

                dark:bg-slate-800

                sm:max-w-xl
                sm:rounded-2xl
                sm:p-6
              "
            >
              {/* Header */}

              <div
                className="
                  mb-6

                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >
                <div>
                  <h2
                    className="
                      text-xl
                      font-bold

                      text-gray-900

                      dark:text-white
                    "
                  >
                    Edit Wastage
                  </h2>

                  <p
                    className="
                      mt-1

                      text-sm

                      text-gray-500

                      dark:text-gray-400
                    "
                  >
                    Update the history record and financial amount.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeEdit
                  }
                  disabled={
                    saving
                  }
                  className="
                    flex
                    h-9
                    w-9
                    flex-shrink-0
                    items-center
                    justify-center

                    rounded-xl

                    text-gray-400

                    transition

                    hover:bg-gray-100
                    hover:text-gray-700

                    disabled:opacity-50

                    dark:hover:bg-slate-700
                    dark:hover:text-white
                  "
                >
                  <X
                    size={
                      21
                    }
                  />
                </button>
              </div>

              <form
                onSubmit={
                  handleSaveEdit
                }
                className="
                  space-y-4
                "
              >
                {/* Date */}

                <div>
                  <label
                    className="
                      mb-1.5
                      block

                      text-sm
                      font-medium

                      text-gray-700

                      dark:text-gray-300
                    "
                  >
                    Date *
                  </label>

                  <input
                    type="date"
                    name="date"
                    value={
                      editForm.date
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      saving
                    }
                    required
                    className="
                      w-full

                      rounded-xl

                      border
                      border-gray-300

                      bg-white

                      px-4
                      py-2.5

                      text-[16px]
                      text-gray-900

                      outline-none

                      transition

                      focus:border-amber-500
                      focus:ring-2
                      focus:ring-amber-500/20

                      disabled:opacity-60

                      dark:border-slate-600
                      dark:bg-slate-900
                      dark:text-white
                    "
                  />
                </div>

                {/* Description */}

                <div>
                  <label
                    className="
                      mb-1.5
                      block

                      text-sm
                      font-medium

                      text-gray-700

                      dark:text-gray-300
                    "
                  >
                    Description *
                  </label>

                  <textarea
                    name="description"
                    value={
                      editForm.description
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      saving
                    }
                    required
                    rows={
                      3
                    }
                    className="
                      w-full

                      resize-y

                      rounded-xl

                      border
                      border-gray-300

                      bg-white

                      px-4
                      py-2.5

                      text-[16px]
                      text-gray-900

                      outline-none

                      transition

                      focus:border-amber-500
                      focus:ring-2
                      focus:ring-amber-500/20

                      disabled:opacity-60

                      dark:border-slate-600
                      dark:bg-slate-900
                      dark:text-white
                    "
                    placeholder="Wastage description"
                  />

                  <p
                    className="
                      mt-1

                      text-xs

                      text-gray-400
                    "
                  >
                    Historical floating-point values such as 3.879999 ml are automatically shown as 3.88 ml.
                  </p>
                </div>

                {/* Reference */}

                <div>
                  <label
                    className="
                      mb-1.5
                      block

                      text-sm
                      font-medium

                      text-gray-700

                      dark:text-gray-300
                    "
                  >
                    Reference / SKU
                  </label>

                  <input
                    type="text"
                    name="reference"
                    value={
                      editForm.reference
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      saving
                    }
                    className="
                      w-full

                      rounded-xl

                      border
                      border-gray-300

                      bg-white

                      px-4
                      py-2.5

                      text-[16px]
                      text-gray-900

                      outline-none

                      transition

                      focus:border-amber-500
                      focus:ring-2
                      focus:ring-amber-500/20

                      disabled:opacity-60

                      dark:border-slate-600
                      dark:bg-slate-900
                      dark:text-white
                    "
                    placeholder="Example: MisDio"
                  />
                </div>

                {/* Amount */}

                <div>
                  <label
                    className="
                      mb-1.5
                      block

                      text-sm
                      font-medium

                      text-gray-700

                      dark:text-gray-300
                    "
                  >
                    Amount (৳) *
                  </label>

                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={
                      editForm.amount
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      saving
                    }
                    required
                    className="
                      w-full

                      rounded-xl

                      border
                      border-gray-300

                      bg-white

                      px-4
                      py-2.5

                      text-[16px]
                      text-gray-900

                      outline-none

                      transition

                      focus:border-amber-500
                      focus:ring-2
                      focus:ring-amber-500/20

                      disabled:opacity-60

                      dark:border-slate-600
                      dark:bg-slate-900
                      dark:text-white
                    "
                    placeholder="0.00"
                  />

                  <p
                    className="
                      mt-1

                      text-xs

                      text-gray-400
                    "
                  >
                    Changing this amount also updates the linked cash-out transaction.
                  </p>
                </div>

                {/* Notes */}

                <div>
                  <label
                    className="
                      mb-1.5
                      block

                      text-sm
                      font-medium

                      text-gray-700

                      dark:text-gray-300
                    "
                  >
                    Notes
                  </label>

                  <textarea
                    name="notes"
                    value={
                      editForm.notes
                    }
                    onChange={
                      handleEditChange
                    }
                    disabled={
                      saving
                    }
                    rows={
                      3
                    }
                    className="
                      w-full

                      resize-y

                      rounded-xl

                      border
                      border-gray-300

                      bg-white

                      px-4
                      py-2.5

                      text-[16px]
                      text-gray-900

                      outline-none

                      transition

                      focus:border-amber-500
                      focus:ring-2
                      focus:ring-amber-500/20

                      disabled:opacity-60

                      dark:border-slate-600
                      dark:bg-slate-900
                      dark:text-white
                    "
                    placeholder="Optional notes"
                  />
                </div>

                {/* Warning */}

                <div
                  className="
                    rounded-xl

                    border
                    border-amber-200

                    bg-amber-50

                    p-3

                    text-xs
                    leading-5

                    text-amber-800

                    dark:border-amber-900/50
                    dark:bg-amber-900/20
                    dark:text-amber-300
                  "
                >
                  Editing this page changes the wastage history/expense record. It does not recalculate physical raw-material or bottle stock.
                </div>

                {/* Buttons */}

                <div
                  className="
                    flex
                    flex-col-reverse

                    gap-3

                    pt-2

                    sm:flex-row
                  "
                >
                  <button
                    type="button"
                    onClick={
                      closeEdit
                    }
                    disabled={
                      saving
                    }
                    className="
                      min-h-[46px]
                      flex-1

                      rounded-xl

                      border
                      border-gray-300

                      px-4

                      font-medium

                      text-gray-700

                      transition

                      hover:bg-gray-50

                      disabled:cursor-not-allowed
                      disabled:opacity-50

                      dark:border-slate-600
                      dark:text-gray-200
                      dark:hover:bg-slate-700
                    "
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    className="
                      flex
                      min-h-[46px]
                      flex-1
                      items-center
                      justify-center
                      gap-2

                      rounded-xl

                      bg-amber-500

                      px-4

                      font-semibold

                      text-white

                      transition

                      hover:bg-amber-600

                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {saving ? (
                      <>
                        <Loader2
                          size={
                            18
                          }
                          className="
                            animate-spin
                          "
                        />

                        Saving...
                      </>
                    ) : (
                      <>
                        <Save
                          size={
                            18
                          }
                        />

                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

export default WastageList;