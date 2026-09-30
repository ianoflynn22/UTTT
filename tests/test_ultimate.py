import pytest
import random
from game.ultimate import UltimateGame


def test_ultimate_3x3_has_nine_local_boards():
    game = UltimateGame(3)

    assert len(game.local_boards) == 9


def test_ultimate_3x3_local_boards_are_3x3():
    game = UltimateGame(3)

    assert all(board.size == 3 for board in game.local_boards)


def test_ultimate_3x3_has_3x3_meta_board():
    game = UltimateGame(3)

    assert game.meta_board.size == 3


def test_ultimate_4x4_has_sixteen_local_boards():
    game = UltimateGame(4)

    assert len(game.local_boards) == 16


def test_ultimate_4x4_local_boards_are_4x4():
    game = UltimateGame(4)

    assert all(board.size == 4 for board in game.local_boards)


def test_ultimate_4x4_has_4x4_meta_board():
    game = UltimateGame(4)

    assert game.meta_board.size == 4


def test_ultimate_game_starts_with_x():
    game = UltimateGame(3)

    assert game.current_player == "X"


def test_ultimate_game_starts_without_a_winner():
    game = UltimateGame(3)

    assert game.winner is None
    assert game.game_over is False


def test_ultimate_game_starts_without_target_board():
    game = UltimateGame(3)

    assert game.target_board is None

def test_parse_ultimate_move():
    game = UltimateGame(3)

    assert game.parse_move("5.7") == (4, 6)

def test_parse_ultimate_plus_move():
    game = UltimateGame(4)

    assert game.parse_move("16.16") == (15, 15)

def test_parse_move_rejects_missing_dot():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="format"):
        game.parse_move("57")

def test_parse_move_rejects_board_zero():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Board number is out of range"):
        game.parse_move("0.1")

def test_parse_move_rejects_board_too_large():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Board number is out of range"):
        game.parse_move("10.1")

def test_parse_move_rejects_cell_zero():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Cell number is out of range"):
        game.parse_move("1.0")

def test_parse_move_rejects_cell_too_large():
    game = UltimateGame(3)

    with pytest.raises(ValueError, match="Cell number is out of range"):
        game.parse_move("1.10")

def test_first_move_can_be_in_any_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.local_boards[4].cells[6] == "X"

def test_first_move_sets_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.target_board == 6

def test_first_move_switches_to_o():
    game = UltimateGame(3)

    game.make_move("5.7")

    assert game.current_player == "O"

def test_second_player_must_play_in_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    with pytest.raises(
        ValueError,
        match="You must play in the target board",
    ):
        game.make_move("3.1")

def test_second_player_can_play_in_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")
    game.make_move("7.1")

    assert game.local_boards[6].cells[0] == "O"

def test_second_move_sets_next_target_board():
    game = UltimateGame(3)

    game.make_move("5.7")
    game.make_move("7.1")

    assert game.target_board == 0

def test_local_board_winner_is_recorded():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "X")

    game.update_local_board(4)

    assert game.completed_boards[4] == "X"

def test_local_board_o_winner_is_recorded():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "O")
    board.make_move(3, "O")
    board.make_move(6, "O")

    game.update_local_board(4)

    assert game.completed_boards[4] == "O"

def test_unfinished_local_board_has_no_winner():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "X")
    board.make_move(1, "X")

    game.update_local_board(4)

    assert game.completed_boards[4] is None

def test_completed_local_board_rejects_moves():
    game = UltimateGame(3)

    game.completed_boards[4] = "X"
    game.target_board = 4

    with pytest.raises(
        ValueError,
        match="This board has already been completed",
    ):
        game.make_move("5.1")

def test_drawn_local_board_is_recorded():
    game = UltimateGame(3)

    board = game.local_boards[4]

    moves = [
        (0, "X"),
        (1, "O"),
        (2, "X"),
        (4, "O"),
        (3, "X"),
        (5, "O"),
        (7, "X"),
        (6, "O"),
        (8, "X"),
    ]

    for position, player in moves:
        board.make_move(position, player)

    game.update_local_board(4)

    assert game.completed_boards[4] == "D"

def test_drawn_local_board_rejects_moves():
    game = UltimateGame(3)

    game.completed_boards[4] = "D"
    game.target_board = 4

    with pytest.raises(
        ValueError,
        match="This board has already been completed",
    ):
        game.make_move("5.1")

def test_all_boards_are_available_at_start():
    game = UltimateGame(3)

    assert game.get_available_boards() == list(range(9))

def test_completed_boards_are_not_available():
    game = UltimateGame(3)

    game.completed_boards[1] = "X"
    game.completed_boards[4] = "O"
    game.completed_boards[7] = "D"

    assert game.get_available_boards() == [
        0, 2, 3, 5, 6, 8
    ]

def test_ultimate_plus_has_sixteen_available_boards():
    game = UltimateGame(4)

    assert game.get_available_boards() == list(range(16))

def test_completed_target_board_allows_choice_of_any_available_board():
    game = UltimateGame(3)

    game.make_move("5.7")

    # Board 7 is the target.
    # Mark it as completed before O's move.
    game.completed_boards[6] = "X"

    game.make_move("2.1")

    assert game.local_boards[1].cells[0] == "O"

def test_completed_target_board_does_not_allow_completed_board_choice():
    game = UltimateGame(3)

    game.make_move("5.7")

    game.completed_boards[6] = "X"
    game.completed_boards[1] = "O"

    with pytest.raises(
        ValueError,
        match="This board has already been completed",
    ):
        game.make_move("2.1")

def test_local_x_win_updates_meta_board():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "X")

    game.update_local_board(4)

    assert game.completed_boards[4] == "X"
    assert game.meta_board.cells[4] == "X"

def test_local_o_win_updates_meta_board():
    game = UltimateGame(3)

    board = game.local_boards[4]

    board.make_move(0, "O")
    board.make_move(3, "O")
    board.make_move(6, "O")

    game.update_local_board(4)

    assert game.completed_boards[4] == "O"
    assert game.meta_board.cells[4] == "O"

def test_drawn_local_board_does_not_update_meta_board():
    game = UltimateGame(3)

    board = game.local_boards[4]

    moves = [
        (0, "X"),
        (1, "O"),
        (2, "X"),
        (4, "O"),
        (3, "X"),
        (5, "O"),
        (7, "X"),
        (6, "O"),
        (8, "X"),
    ]

    for position, player in moves:
        board.make_move(position, player)

    game.update_local_board(4)

    assert game.completed_boards[4] == "D"
    assert game.meta_board.cells[4] is None

def test_x_wins_ultimate_game():
    game = UltimateGame(3)

    for board_index in [0, 1, 2]:
        board = game.local_boards[board_index]

        board.make_move(0, "X")
        board.make_move(1, "X")
        board.make_move(2, "X")

        game.update_local_board(board_index)

    assert game.meta_board.cells[0] == "X"
    assert game.meta_board.cells[1] == "X"
    assert game.meta_board.cells[2] == "X"

    assert game.winner == "X"
    assert game.game_over is True

def test_o_wins_ultimate_game():
    game = UltimateGame(3)

    for board_index in [0, 3, 6]:
        board = game.local_boards[board_index]

        board.make_move(0, "O")
        board.make_move(3, "O")
        board.make_move(6, "O")

        game.update_local_board(board_index)

    assert game.meta_board.cells[0] == "O"
    assert game.meta_board.cells[3] == "O"
    assert game.meta_board.cells[6] == "O"

    assert game.winner == "O"
    assert game.game_over is True

def test_ultimate_game_does_not_end_after_one_local_win():
    game = UltimateGame(3)

    board = game.local_boards[0]

    board.make_move(0, "X")
    board.make_move(1, "X")
    board.make_move(2, "X")

    game.update_local_board(0)

    assert game.winner is None
    assert game.game_over is False

def test_ultimate_game_can_end_in_a_draw():
    game = UltimateGame(3)

    game.completed_boards = [
        "X", "O", "X",
        "X", "O", "O",
        "O", "X", "X",
    ]

    game.check_draw()

    assert game.winner is None
    assert game.game_over is True

def test_ultimate_draw_does_not_create_a_winner():
    game = UltimateGame(3)

    results = [
        "X", "O", "X",
        "X", "O", "O",
        "O", "X", "X",
    ]

    for position, result in enumerate(results):
        game.completed_boards[position] = result
        game.meta_board.make_move(position, result)

    game.check_winner()
    game.check_draw()

    assert game.meta_board.get_winner() is None
    assert game.winner is None
    assert game.game_over is True

def test_ultimate_plus_starts_with_no_plus_symbols():
    game = UltimateGame(4)

    assert game.plus_count == 0
    assert game.max_plus == 3

def test_ultimate_move_symbol_is_normal_player():
    game = UltimateGame(3)

    assert game.get_move_symbol() == "X"

def test_ultimate_plus_can_generate_plus(monkeypatch):
    game = UltimateGame(4)

    monkeypatch.setattr(random, "randint", lambda a, b: 1)

    assert game.get_move_symbol() == "+"
    assert game.plus_count == 1