module.exports = {
	status	: true,
	data	: {
		id : 1,
		name : 'A',
		plan : {
			time : {
				date : '2020-08-31',
				start : '23:00:00',
				finish : '00:00:00',
			},
			kanban : {
				part : {
					number : '12344',
					name : 'Griller'
				},
				ct : 640000, //in ms
				target : 15,
				qty : 2,
			},
		},
		breaks : [
			{
				start : '11:45:00',
				finish : '11:45:30',
			},
		],
	},
}
