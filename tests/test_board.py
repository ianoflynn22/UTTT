from game.board import Board


def test_empty_board_has_no_winner():
    board = Board(3)

    assert board.get_winner() is None

def test_x_wins_with_top_row():
    board = Board(3)

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "X")

    assert board.get_winner() == "X"

def test_o_wins_with_left_column():
    board = Board(3)

    board.make_move(0, "O")
    board.make_move(3, "O")
    board.make_move(6, "O")

    assert board.get_winner() == "O"

def test_x_can_win_using_plus():
    board = Board(4)

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "+")
    board.make_move(3, "X")

    assert board.get_winner() == "X"

def test_o_can_win_using_plus():
    board = Board(4)

    board.make_move(0, "O")
    board.make_move(1, "O")
    board.make_move(2, "+")
    board.make_move(3, "O")

    assert board.get_winner() == "O"