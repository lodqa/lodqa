require_relative '../strsim'

describe 'get_trigrams' do
	context 'when str is nil' do
		before do
			@result = Strsim.get_trigrams(nil)
		end
		it 'should return an empty array' do
			@result.should eql([])
		end
	end
	context 'when str is empty' do
		before do
			@result = Strsim.get_trigrams('')
		end
		it 'should return an empty array' do
			@result.should eql([])
		end
	end
	context 'when str is "ab cd"' do
		before do
			@result = Strsim.get_trigrams('ab c')
		end
		it 'should return ["__a", "_ab", "ab ", "b c", " c_", "c__"]' do
			@result.should eql(["__a", "_ab", "ab ", "b c", " c_", "c__"])
		end
	end

end