class Board:
    def __init__(self, size):
        self.size = size
        self.cells = [None] * (size * size)

    def make_move(self, position, symbol):
        if position < 0 or position >= len(self.cells):
            raise ValueError("Position is out of range")

        if self.cells[position] is not None:
            raise ValueError("Position is already occupied")

        self.cells[position] = symbol

    def __str__(self):
        rows = []

        for row in range(self.size):
            start = row * self.size
            end = start + self.size

            cells = self.cells[start:end]

            row_string = "|".join(
                f"{cell if cell is not None else ' ':^3}"
                for cell in cells
            )

            rows.append(row_string)

        separator = "\n" + "---+" * (self.size - 1) + "---\n"

        return separator.join(rows)
    
    def get_rows(self):
        rows = []

        for row in range(self.size):
            start = row * self.size
            row_positions = list(range(start, start + self.size))
            rows.append(row_positions)

        return rows
    
    def get_columns(self):
        columns = []

        for column in range(self.size):
            column_positions = list(
                range(column, self.size * self.size, self.size)
            )
            columns.append(column_positions)

        return columns
    
    def get_diagonals(self):
        main_diagonal = list(
            range(0, self.size * self.size, self.size + 1)
        )

        anti_diagonal = list(
            range(self.size - 1, self.size * self.size - 1, self.size - 1)
        )

        return [main_diagonal, anti_diagonal]
    
    def get_winning_lines(self):
        return (
            self.get_rows()
            + self.get_columns()
            + self.get_diagonals()
        )
    
    def line_belongs_to(self, line, symbol):
        return all(
            self.cells[position] == symbol
            or self.cells[position] == "+"
            for position in line
        )
    
    def get_winner(self):
        for line in self.get_winning_lines():
            if self.line_belongs_to(line, "X"):
                return "X"

            if self.line_belongs_to(line, "O"):
                return "O"

        return None
    
    def is_full(self):
        return all(cell is not None for cell in self.cells)